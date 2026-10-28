import type { CodeSnapshot, HintsState, Language, RunResponse } from "@rehearse/shared";
import {
  TranscriptRecorder,
  type HintRecord,
  type InterviewRecord,
  type RunRecord,
  type SnapshotRecord,
} from "../feedback/record.js";
import { codeContextMessage, type ForwardedCode } from "./codeContext.js";
import { hintsState } from "./hints.js";
import { buildInstructions } from "./prompt.js";
import { RUN_DECISION_PROMPT, runResultMessage } from "./runSummary.js";
import type { ConnectSideband, SidebandSocket } from "./sideband.js";
import {
  elapsedMinutes,
  recordSnapshot,
  transition,
  type InterviewEvent,
  type InterviewSession,
  type TransitionResult,
} from "./session.js";
import { handleToolCall, INTERVIEW_TOOLS } from "./tools.js";

type Options = {
  now?: () => number;
  // how often the clock gets a chance to move the phase. phases are minutes long, so this is plenty
  tickMs?: number;
  log?: (msg: string) => void;
  // once, when the interview is over: everything that happened, for the feedback report
  onEnded?: (record: InterviewRecord) => void;
  // at most one code update to the model per this many ms; the newest snapshot always wins.
  // 0 forwards immediately (tests)
  codeForwardMs?: number;
};

type FunctionCall = { type: "function_call"; name: string; arguments: string; call_id: string };

type ServerEvent = {
  type?: string;
  item?: { id?: string; type?: string };
  response?: {
    id?: string;
    metadata?: Record<string, string> | null;
    output?: { type?: string; content?: { text?: string; transcript?: string }[] }[];
  };
};

// something the interviewer should say as soon as it's free. a hint the candidate asked for
// always gets said; a reaction to a run is only worth it while the run is fresh
type Speech = { reason: "hint" | "run"; note: string };

// tags our out-of-band "should the interviewer comment?" responses so they're never
// mistaken for the interviewer talking
const RUN_DECISION = "run-decision";
// conversation items the comment decision gets to see, newest last
const RECENT_ITEMS = 8;

// runs one interview: owns its session, watches the call over the sideband, keeps the
// realtime session's instructions in step with the phase, and feeds it code, test results,
// and hints
export class InterviewController {
  session: InterviewSession;
  private socket: SidebandSocket | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private codeTimer: ReturnType<typeof setTimeout> | null = null;
  private lastCodeForwardAt = -Infinity;
  // what the model has seen of the code so far, so the next update can be a diff
  private forwardedCode: ForwardedCode | null = null;
  // in-band responses still being generated, i.e. the interviewer is mid-reply
  private activeResponses = new Set<string>();
  private pendingSpeech: Speech | null = null;
  private recentItems: string[] = [];
  private hintListeners = new Set<(state: HintsState) => void>();
  // the history the feedback report is written from
  private recorder = new TranscriptRecorder();
  private snapshots: SnapshotRecord[] = [];
  private runs: RunRecord[] = [];
  private hintLog: HintRecord[] = [];
  private nextHintVia: HintRecord["via"] = "voice";
  private ended = false;
  private readonly now: () => number;
  private readonly log: (msg: string) => void;

  constructor(
    session: InterviewSession,
    private readonly opts: Options = {},
  ) {
    this.session = session;
    this.now = opts.now ?? Date.now;
    this.log = opts.log ?? console.log;
  }

  get attached() {
    return this.socket !== null;
  }

  get hints(): HintsState {
    return hintsState(this.session);
  }

  // the browser's sockets listen here so the hint card updates however a hint unlocked
  onHintsChanged(listener: (state: HintsState) => void) {
    this.hintListeners.add(listener);
    return () => void this.hintListeners.delete(listener);
  }

  private instructions(rightNow?: string) {
    const base = buildInstructions({
      problem: this.session.problem,
      phase: this.session.phase,
      elapsedMinutes: elapsedMinutes(this.session, this.now()),
      hintsUsed: this.session.hintsUsed,
      timeUp: this.session.timeUp,
      timing: this.session.timing,
    });
    return rightNow ? `${base}\n\nRight now: ${rightNow}` : base;
  }

  // the instructions and tools the call should have right now
  sessionConfig() {
    return {
      type: "realtime",
      instructions: this.instructions(),
      tools: INTERVIEW_TOOLS,
      tool_choice: "auto",
    };
  }

  async attach(callId: string, connect: ConnectSideband) {
    this.socket = await connect(callId);
    // the interview clock starts when the call is actually up, not when the token was minted
    const at = this.now();
    this.session = { ...this.session, startedAt: at, phaseStartedAt: at };
    this.socket.onMessage((raw) => this.onServerEvent(raw));
    this.socket.onClose(() => this.dispose());
    this.timer = setInterval(
      () => this.apply({ type: "tick", at: this.now() }),
      this.opts.tickMs ?? 5000,
    );
    // the http server keeps the process alive; this timer shouldn't on its own
    this.timer.unref();
    this.pushInstructions();
    // code typed before the server joined the call
    this.forwardCode();
    this.log(`[interview ${this.session.id}] attached to call, phase ${this.session.phase}`);
  }

  // seconds into the interview, for the record
  private get secondsIn() {
    return Math.max(0, Math.round((this.now() - this.session.startedAt) / 1000));
  }

  // everything that happened so far
  record(): InterviewRecord {
    return {
      sessionId: this.session.id,
      problem: this.session.problem,
      startedAt: this.session.startedAt,
      endedAt: this.now(),
      phases: this.session.history,
      transcript: this.recorder.transcript,
      snapshots: [...this.snapshots],
      runs: [...this.runs],
      hints: [...this.hintLog],
    };
  }

  // the candidate ended it. same as the call dropping: wrap up and hand over the record
  end() {
    this.dispose();
  }

  // a snapshot from the browser. false if it's older than one we already have
  receiveCode(snapshot: CodeSnapshot) {
    const result = recordSnapshot(this.session, snapshot);
    if (!result.accepted) return false;
    this.session = result.session;
    this.snapshots.push({ ...snapshot, at: this.secondsIn });
    this.scheduleCodeForward();
    return true;
  }

  // after every Run or Submit: the results become context, then the model decides, out of
  // band, whether they're worth saying anything about
  receiveRunResult(result: RunResponse, language: Language) {
    this.runs.push({
      at: this.secondsIn,
      mode: result.mode,
      language,
      codeVersion: this.session.code?.version ?? null,
      result,
    });
    if (!this.socket) return;
    const summary = runResultMessage(result, language, elapsedMinutes(this.session, this.now()));
    // make sure the results are judged against the code that produced them
    this.forwardCode();
    this.addContext(summary);
    // mid-reply, the interviewer will see the results on its next turn anyway
    if (this.busy) return;
    this.send({
      type: "response.create",
      response: {
        conversation: "none",
        output_modalities: ["text"],
        metadata: { purpose: RUN_DECISION },
        input: [
          ...this.recentItems.map((id) => ({ type: "item_reference", id })),
          {
            type: "message",
            role: "system",
            content: [{ type: "input_text", text: `${RUN_DECISION_PROMPT}\n\n${summary}` }],
          },
        ],
      },
    });
  }

  // the hint button. releases the next hint in order and has the interviewer deliver it.
  // false once every hint is used
  requestHint() {
    if (!this.socket) return false;
    const result = transition(this.session, { type: "hint_given", at: this.now() });
    if (result.session.hintsUsed === this.session.hintsUsed) return false;
    this.nextHintVia = "button";
    this.commit(result);
    const { number, text } = this.hints.unlocked.at(-1)!;
    const total = this.session.problem.hints.length;
    this.addContext(
      `The candidate pressed the hint button, which unlocked hint ${number} of ${total}. Its idea, for you to put in your own words: ${text}`,
    );
    this.speak({
      reason: "hint",
      note: `the candidate just asked for a hint with the button. Deliver hint ${number} from the latest system message as a short nudge or question in your own words. Don't read it word for word, and don't call give_hint for it.`,
    });
    return true;
  }

  apply(event: InterviewEvent) {
    this.commit(transition(this.session, event));
  }

  dispose() {
    if (this.ended) return;
    this.ended = true;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    if (this.codeTimer) clearTimeout(this.codeTimer);
    this.codeTimer = null;
    this.hintListeners.clear();
    const socket = this.socket;
    this.socket = null;
    socket?.close();
    this.opts.onEnded?.(this.record());
  }

  private get busy() {
    return this.activeResponses.size > 0;
  }

  private commit(result: TransitionResult) {
    const before = this.session;
    this.session = result.session;
    if (result.phaseChanged) {
      const change = this.session.history.at(-1);
      this.log(
        `[interview ${this.session.id}] ${before.phase} -> ${this.session.phase} (${change?.reason}) at ${elapsedMinutes(this.session, this.now()).toFixed(1)} min`,
      );
    }
    if (result.promptChanged) this.pushInstructions();
    if (this.session.hintsUsed !== before.hintsUsed) {
      for (let n = before.hintsUsed + 1; n <= this.session.hintsUsed; n++) {
        this.hintLog.push({ number: n, at: this.secondsIn, via: this.nextHintVia });
      }
      this.nextHintVia = "voice";
      const state = this.hints;
      for (const listener of this.hintListeners) listener(state);
    }
  }

  private send(event: object) {
    this.socket?.send(JSON.stringify(event));
  }

  // a system message adds context without making the interviewer reply to it
  private addContext(text: string) {
    this.send({
      type: "conversation.item.create",
      item: { type: "message", role: "system", content: [{ type: "input_text", text }] },
    });
  }

  // have the interviewer talk now, or as soon as its current reply is done
  private speak(speech: Speech) {
    if (this.busy) {
      // a hint someone asked for outranks a comment on a run
      if (this.pendingSpeech?.reason !== "hint" || speech.reason === "hint")
        this.pendingSpeech = speech;
      return;
    }
    this.send({
      type: "response.create",
      response: { instructions: this.instructions(speech.note) },
    });
  }

  // throttle: forward now if it's been long enough, otherwise once the window is up.
  // whatever the latest snapshot is at that point is what gets sent
  private scheduleCodeForward() {
    if (this.codeTimer) return;
    const every = this.opts.codeForwardMs ?? 3000;
    const wait = Math.max(0, this.lastCodeForwardAt + every - this.now());
    if (wait === 0) return this.forwardCode();
    this.codeTimer = setTimeout(() => {
      this.codeTimer = null;
      this.forwardCode();
    }, wait);
    this.codeTimer.unref();
  }

  private forwardCode() {
    const code = this.session.code;
    if (!this.socket || !code) return;
    const message = codeContextMessage(
      this.forwardedCode,
      code,
      elapsedMinutes(this.session, this.now()),
    );
    if (!message) return;
    this.forwardedCode = message.forwarded;
    this.lastCodeForwardAt = this.now();
    this.addContext(message.text);
  }

  private pushInstructions() {
    this.send({ type: "session.update", session: this.sessionConfig() });
  }

  private onServerEvent(raw: string) {
    let event: ServerEvent;
    try {
      event = JSON.parse(raw);
    } catch {
      return;
    }
    const purpose = event.response?.metadata?.purpose;
    this.recorder.onEvent(event, this.secondsIn);

    switch (event.type) {
      case "conversation.item.added": {
        // remembered so the out-of-band decision can see what was just said
        const id = event.item?.id;
        if (id && (event.item?.type === "message" || event.item?.type === "function_call_output")) {
          this.recentItems = [...this.recentItems, id].slice(-RECENT_ITEMS);
        }
        return;
      }
      case "response.created":
        if (purpose !== RUN_DECISION && event.response?.id)
          this.activeResponses.add(event.response.id);
        return;
      case "response.done":
        if (purpose === RUN_DECISION) return this.onRunDecision(event);
        if (event.response?.id) this.activeResponses.delete(event.response.id);
        if (this.handleToolCalls(event)) return;
        if (!this.busy && this.pendingSpeech) {
          const next = this.pendingSpeech;
          this.pendingSpeech = null;
          this.speak(next);
        }
        return;
    }
  }

  private onRunDecision(event: ServerEvent) {
    const text = (event.response?.output ?? [])
      .flatMap((item) => item.content ?? [])
      .map((part) => part.text ?? part.transcript ?? "")
      .join(" ");
    if (!/\bCOMMENT\b/i.test(text)) return;
    // by now the interviewer may have started talking on its own; then it's moot
    if (this.busy) return;
    this.speak({
      reason: "run",
      note: "the candidate just ran their code (see the latest Test run message). React in one or two short sentences, ideally with a question that helps them find the problem themselves. Don't recite the results.",
    });
  }

  // tool calls arrive as function_call items in a finished response. true if there were any
  private handleToolCalls(event: ServerEvent) {
    const calls = (event.response?.output ?? []).filter(
      (item): item is FunctionCall => (item as FunctionCall)?.type === "function_call",
    );
    if (calls.length === 0) return false;
    for (const call of calls) {
      const result = handleToolCall(this.session, call.name, call.arguments, this.now());
      this.commit(result);
      this.send({
        type: "conversation.item.create",
        item: { type: "function_call_output", call_id: call.call_id, output: result.output },
      });
    }
    // the model stops after a tool call; this lets it carry on and actually say the hint
    this.send({ type: "response.create" });
    return true;
  }
}
