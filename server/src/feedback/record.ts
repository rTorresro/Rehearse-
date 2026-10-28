import type { CodeSnapshot, Language, Problem, RunResponse } from "@rehearse/shared";
import type { PhaseChange } from "../interview/session.js";

export type TranscriptLine = {
  id: string;
  role: "candidate" | "interviewer";
  // seconds from interview start
  at: number;
  text: string;
};

export type SnapshotRecord = CodeSnapshot & { at: number };

export type RunRecord = {
  at: number;
  mode: RunResponse["mode"];
  language: Language;
  // the newest snapshot when the run came in, so feedback can line results up with code
  codeVersion: number | null;
  result: RunResponse;
};

export type HintRecord = { number: number; at: number; via: "voice" | "button" };

// everything that happened in one interview, as the feedback model will see it
export type InterviewRecord = {
  sessionId: string;
  problem: Problem;
  startedAt: number;
  endedAt: number;
  phases: PhaseChange[];
  transcript: TranscriptLine[];
  snapshots: SnapshotRecord[];
  runs: RunRecord[];
  hints: HintRecord[];
};

type RealtimeEvent = {
  type?: string;
  item?: { id?: string; type?: string; role?: string };
  previous_item_id?: string | null;
  item_id?: string;
  delta?: string;
  transcript?: string;
};

// rebuilds both sides of the conversation from the realtime events the server sees on the
// sideband. lines are ordered by the conversation (previous_item_id), not by arrival: the
// candidate's transcription can land after the interviewer has already started answering
export class TranscriptRecorder {
  private lines: TranscriptLine[] = [];

  onEvent(event: RealtimeEvent, at: number) {
    switch (event.type) {
      case "conversation.item.added": {
        const { id, type, role } = event.item ?? {};
        if (!id || type !== "message" || (role !== "user" && role !== "assistant")) return;
        if (this.lines.some((l) => l.id === id)) return;
        const line: TranscriptLine = {
          id,
          role: role === "user" ? "candidate" : "interviewer",
          at,
          text: "",
        };
        const after = event.previous_item_id
          ? this.lines.findIndex((l) => l.id === event.previous_item_id)
          : -1;
        if (after < 0) this.lines.push(line);
        else this.lines.splice(after + 1, 0, line);
        return;
      }
      case "conversation.item.input_audio_transcription.completed":
        return this.set(event.item_id, "candidate", at, () => (event.transcript ?? "").trim());
      case "response.output_audio_transcript.delta":
        return this.set(event.item_id, "interviewer", at, (prev) => prev + (event.delta ?? ""));
      case "response.output_audio_transcript.done":
        return this.set(event.item_id, "interviewer", at, (prev) => event.transcript ?? prev);
    }
  }

  private set(
    id: string | undefined,
    role: TranscriptLine["role"],
    at: number,
    text: (prev: string) => string,
  ) {
    if (!id) return;
    let line = this.lines.find((l) => l.id === id);
    if (!line) {
      line = { id, role, at, text: "" };
      this.lines.push(line);
    }
    line.text = text(line.text);
  }

  // what was actually said: lines with no text (a tap on the mic, a cut-off reply) are dropped
  get transcript(): TranscriptLine[] {
    return this.lines
      .filter((l) => l.text.trim() !== "")
      .map((l) => ({ ...l, text: l.text.trim() }));
  }
}
