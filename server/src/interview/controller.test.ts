import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { InterviewController } from "./controller.js";
import type { SidebandSocket } from "./sideband.js";
import type { RunResponse } from "@rehearse/shared";
import { min, newSession, PROBLEM, T0 } from "./testHelpers.js";

// the parts of outgoing events these tests look at
type Sent = {
  type: string;
  session?: { instructions: string; tools: unknown[] };
  item?: {
    call_id?: string;
    output?: string;
    type?: string;
    role?: string;
    content?: { type: string; text: string }[];
  };
};

// a socket we can push server events into and read what the controller sent
function fakeSocket() {
  const sent: Sent[] = [];
  let onMessage: (d: string) => void = () => {};
  let onClose: () => void = () => {};
  const socket: SidebandSocket = {
    send: (d) => sent.push(JSON.parse(d)),
    close: () => onClose(),
    onMessage: (cb) => (onMessage = cb),
    onClose: (cb) => (onClose = cb),
  };
  return { socket, sent, emit: (e: object) => onMessage(JSON.stringify(e)) };
}

const live: InterviewController[] = [];
afterEach(() => live.splice(0).forEach((c) => c.dispose()));

async function setup(
  opts: { codeForwardMs?: number; beforeAttach?: (c: InterviewController) => void } = {},
) {
  let now = T0;
  const fake = fakeSocket();
  const logs: string[] = [];
  let ended = false;
  const controller = new InterviewController(newSession(), {
    now: () => now,
    tickMs: 1_000_000, // ticks are driven by hand in these tests
    log: (m) => logs.push(m),
    onEnded: () => (ended = true),
    codeForwardMs: opts.codeForwardMs ?? 0,
  });
  opts.beforeAttach?.(controller);
  await controller.attach("rtc_test", async () => fake.socket);
  live.push(controller);
  return {
    controller,
    ...fake,
    logs,
    setNow: (m: number) => (now = min(m)),
    ended: () => ended,
  };
}

const updates = (sent: Sent[]) => sent.filter((e) => e.type === "session.update");

describe("InterviewController", () => {
  it("pushes instructions and tools as soon as it attaches", async () => {
    const { sent } = await setup();
    const [first] = updates(sent);
    assert.ok(first?.session);
    assert.match(first.session.instructions, /Current phase: intro/);
    assert.equal(first.session.tools.length, 2);
  });

  it("sends new instructions when the clock changes the phase", async () => {
    const { controller, sent, setNow, logs } = await setup();
    setNow(3);
    controller.apply({ type: "tick", at: min(3) });
    const last = updates(sent).at(-1);
    assert.match(last?.session?.instructions ?? "", /Current phase: approach/);
    assert.ok(logs.some((l) => l.includes("intro -> approach (time)")));
  });

  it("doesn't resend instructions when nothing changed", async () => {
    const { controller, sent } = await setup();
    const before = updates(sent).length;
    controller.apply({ type: "tick", at: min(1) });
    assert.equal(updates(sent).length, before);
  });

  it("answers a tool call, updates instructions, then lets the model continue", async () => {
    const { sent, emit, setNow } = await setup();
    setNow(2);
    sent.length = 0;
    emit({
      type: "response.done",
      response: {
        output: [
          {
            type: "function_call",
            name: "signal_progress",
            arguments: '{"milestone":"problem_presented"}',
            call_id: "c1",
          },
        ],
      },
    });
    assert.deepEqual(
      sent.map((e) => e.type),
      ["session.update", "conversation.item.create", "response.create"],
    );
    const output = sent[1]?.item;
    assert.equal(output?.call_id, "c1");
    assert.deepEqual(JSON.parse(output?.output ?? "null"), { ok: true, phase: "approach" });
  });

  it("hands out hints through the tool and counts them", async () => {
    const { controller, sent, emit } = await setup();
    emit({
      type: "response.done",
      response: {
        output: [{ type: "function_call", name: "give_hint", arguments: "{}", call_id: "h1" }],
      },
    });
    assert.equal(controller.session.hintsUsed, 1);
    const last = updates(sent).at(-1);
    assert.match(last?.session?.instructions ?? "", /Hints: 1 of 3 used/);
  });

  it("ignores responses without tool calls", async () => {
    const { sent, emit } = await setup();
    const before = sent.length;
    emit({ type: "response.done", response: { output: [{ type: "message" }] } });
    emit({ type: "response.output_audio_transcript.delta", delta: "hi" });
    assert.equal(sent.length, before);
  });

  it("cleans up when the call ends", async () => {
    const { controller, ended } = await setup();
    controller.dispose();
    assert.equal(ended(), true);
    assert.equal(controller.attached, false);
  });
});

const snap = (version: number, code: string) => ({
  version,
  timestamp: T0,
  language: "python" as const,
  code,
});
const codeMessages = (sent: Sent[]) =>
  sent
    .filter((e) => e.type === "conversation.item.create" && e.item?.role === "system")
    .map((e) => e.item!.content![0]!.text);

describe("code snapshots", () => {
  it("forwards code as a system message, without asking for a reply", async () => {
    const { controller, sent } = await setup();
    sent.length = 0;
    assert.equal(controller.receiveCode(snap(1, "def f():\n    pass")), true);
    assert.equal(controller.session.code?.version, 1);
    const [text] = codeMessages(sent);
    assert.match(text ?? "", /^Code snapshot v1/);
    assert.ok(!sent.some((e) => e.type === "response.create"));
  });

  it("sends code typed before the server joined the call once it attaches", async () => {
    const { sent } = await setup({ beforeAttach: (c) => c.receiveCode(snap(3, "x = 1")) });
    assert.match(codeMessages(sent)[0] ?? "", /^Code snapshot v3/);
  });

  it("ignores stale versions and unchanged code", async () => {
    const { controller, sent } = await setup();
    controller.receiveCode(snap(2, "a"));
    assert.equal(controller.receiveCode(snap(1, "old")), false);
    controller.receiveCode(snap(3, "a"));
    assert.equal(codeMessages(sent).length, 1);
  });

  it("throttles updates to the model and sends only the latest", async (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const { controller, sent, setNow } = await setup({ codeForwardMs: 3000 });
    controller.receiveCode(snap(1, "a = 1"));
    setNow(0.01);
    controller.receiveCode(snap(2, "a = 2"));
    controller.receiveCode(snap(3, "a = 3"));
    assert.equal(codeMessages(sent).length, 1, "second and third wait for the window");

    setNow(0.05);
    t.mock.timers.tick(3000);
    const msgs = codeMessages(sent);
    assert.equal(msgs.length, 2);
    assert.match(msgs[1]!, /^Code snapshot v3/);
  });
});

// a finished Run with one visible failure and a hidden failure
const runResult = (overrides: Partial<RunResponse> = {}): RunResponse => ({
  mode: "submit",
  verdict: "wrong_answer",
  passed: 2,
  total: 4,
  cases: [
    {
      index: 0,
      hidden: false,
      status: "passed",
      runtimeMs: 5,
      memoryKb: 1,
      input: "slots = [[1,3]]",
      expected: "[[1,3]]",
      actual: "[[1,3]]",
    },
    {
      index: 1,
      hidden: false,
      status: "failed",
      runtimeMs: 5,
      memoryKb: 1,
      input: "slots = [[1,4],[4,5]]",
      expected: "[[1,5]]",
      actual: "[[1,4],[4,5]]",
    },
    { index: 2, hidden: true, status: "passed", runtimeMs: 5, memoryKb: 1 },
    { index: 3, hidden: true, status: "runtime_error", runtimeMs: 5, memoryKb: 1 },
  ],
  ...overrides,
});
const systemTexts = (sent: Sent[]) =>
  sent
    .filter((e) => e.type === "conversation.item.create" && e.item?.role === "system")
    .map((e) => e.item!.content![0]!.text);
const responses = (sent: Sent[]) =>
  sent.filter((e) => e.type === "response.create") as (Sent & {
    response?: {
      conversation?: string;
      metadata?: { purpose?: string };
      instructions?: string;
      input?: { type: string; id?: string }[];
    };
  })[];

describe("run results", () => {
  it("adds the results as context and asks, out of band, whether to comment", async () => {
    const { controller, sent, emit } = await setup();
    emit({ type: "conversation.item.added", item: { id: "item_a", type: "message" } });
    emit({ type: "conversation.item.added", item: { id: "item_b", type: "message" } });
    sent.length = 0;
    controller.receiveRunResult(runResult(), "python");

    const [summary] = systemTexts(sent);
    assert.match(
      summary ?? "",
      /^Test run \(Submit, about \d+ min in\): the candidate submitted their python solution against all 4 cases \(2 visible, 2 hidden\)\. 2 of 4 passed\./,
    );
    assert.match(
      summary ?? "",
      /Case 2 failed: input slots = \[\[1,4\],\[4,5\]\]\. Expected \[\[1,5\]\], got \[\[1,4\],\[4,5\]\]\./,
    );
    assert.match(summary ?? "", /Hidden cases: 1 passed, 1 crashed\./);

    const [decision] = responses(sent);
    assert.equal(decision?.response?.conversation, "none");
    assert.equal(decision?.response?.metadata?.purpose, "run-decision");
    assert.deepEqual(
      decision?.response?.input?.filter((i) => i.type === "item_reference").map((i) => i.id),
      ["item_a", "item_b"],
    );
  });

  it("speaks only when the decision says COMMENT", async () => {
    for (const [answer, speaks] of [
      ["COMMENT", true],
      ["QUIET", false],
    ] as const) {
      const { controller, sent, emit } = await setup();
      controller.receiveRunResult(runResult(), "python");
      sent.length = 0;
      emit({
        type: "response.done",
        response: {
          id: "oob",
          metadata: { purpose: "run-decision" },
          output: [{ type: "message", content: [{ type: "output_text", text: answer }] }],
        },
      });
      const spoken = responses(sent);
      assert.equal(spoken.length, speaks ? 1 : 0, answer);
      if (speaks)
        assert.match(
          spoken[0]!.response!.instructions ?? "",
          /Right now: the candidate just ran their code/,
        );
    }
  });

  it("doesn't ask while the interviewer is mid-reply, but still adds the context", async () => {
    const { controller, sent, emit } = await setup();
    emit({ type: "response.created", response: { id: "r1" } });
    sent.length = 0;
    controller.receiveRunResult(runResult(), "python");
    assert.equal(systemTexts(sent).length, 1);
    assert.equal(responses(sent).length, 0);
  });
});

describe("hint button", () => {
  it("releases hints in order and has the interviewer deliver each in its own words", async () => {
    const { controller, sent } = await setup();
    const states: number[] = [];
    controller.onHintsChanged((s) => states.push(s.unlocked.length));
    sent.length = 0;

    assert.equal(controller.requestHint(), true);
    assert.equal(controller.session.hintsUsed, 1);
    const [context] = systemTexts(sent);
    assert.ok(
      context?.includes(
        `unlocked hint 1 of 3. Its idea, for you to put in your own words: ${PROBLEM.hints[0]}`,
      ),
      context ?? "no context message",
    );
    const [speech] = responses(sent);
    assert.match(
      speech?.response?.instructions ?? "",
      /Don't read it word for word, and don't call give_hint/,
    );
    // the prompt now knows a hint was used
    const update = sent.find((e) => e.type === "session.update");
    assert.match(update?.session?.instructions ?? "", /Hints: 1 of 3 used/);

    controller.requestHint();
    controller.requestHint();
    assert.deepEqual(states, [1, 2, 3]);
    assert.equal(controller.requestHint(), false, "nothing left");
    assert.deepEqual(
      controller.hints.unlocked.map((h) => h.text),
      [...PROBLEM.hints],
    );
  });

  it("waits for the interviewer to finish before delivering", async () => {
    const { controller, sent, emit } = await setup();
    emit({ type: "response.created", response: { id: "r1" } });
    sent.length = 0;
    controller.requestHint();
    assert.equal(responses(sent).length, 0);
    emit({ type: "response.done", response: { id: "r1", output: [] } });
    assert.equal(responses(sent).length, 1);
  });

  it("a hint asked for by voice updates the hint card too", async () => {
    const { controller, emit } = await setup();
    const states: number[] = [];
    controller.onHintsChanged((s) => states.push(s.unlocked.length));
    emit({
      type: "response.done",
      response: {
        id: "r2",
        output: [{ type: "function_call", name: "give_hint", arguments: "{}", call_id: "c9" }],
      },
    });
    assert.deepEqual(states, [1]);
  });
});
