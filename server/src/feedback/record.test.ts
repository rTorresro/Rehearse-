import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { TranscriptRecorder } from "./record.js";

describe("TranscriptRecorder", () => {
  it("orders lines by the conversation, not by when their text arrives", () => {
    const r = new TranscriptRecorder();
    r.onEvent(
      { type: "conversation.item.added", item: { id: "a1", type: "message", role: "assistant" } },
      1,
    );
    r.onEvent({ type: "response.output_audio_transcript.delta", item_id: "a1", delta: "Hi, " }, 1);
    r.onEvent(
      {
        type: "response.output_audio_transcript.done",
        item_id: "a1",
        transcript: "Hi, how would you approach it?",
      },
      3,
    );
    r.onEvent(
      {
        type: "conversation.item.added",
        item: { id: "u1", type: "message", role: "user" },
        previous_item_id: "a1",
      },
      20,
    );
    // the reply is added before the candidate's transcription finishes
    r.onEvent(
      {
        type: "conversation.item.added",
        item: { id: "a2", type: "message", role: "assistant" },
        previous_item_id: "u1",
      },
      22,
    );
    r.onEvent(
      { type: "response.output_audio_transcript.delta", item_id: "a2", delta: "Good." },
      23,
    );
    r.onEvent(
      {
        type: "conversation.item.input_audio_transcription.completed",
        item_id: "u1",
        transcript: " I'd sort first. ",
      },
      24,
    );
    assert.deepEqual(
      r.transcript.map((l) => [l.role, l.at, l.text]),
      [
        ["interviewer", 1, "Hi, how would you approach it?"],
        ["candidate", 20, "I'd sort first."],
        ["interviewer", 22, "Good."],
      ],
    );
  });

  it("ignores system messages and tool items, and drops lines with no words", () => {
    const r = new TranscriptRecorder();
    r.onEvent(
      { type: "conversation.item.added", item: { id: "s1", type: "message", role: "system" } },
      1,
    );
    r.onEvent(
      { type: "conversation.item.added", item: { id: "f1", type: "function_call_output" } },
      1,
    );
    r.onEvent(
      { type: "conversation.item.added", item: { id: "u1", type: "message", role: "user" } },
      2,
    );
    r.onEvent(
      {
        type: "conversation.item.input_audio_transcription.completed",
        item_id: "u1",
        transcript: "   ",
      },
      3,
    );
    assert.deepEqual(r.transcript, []);
  });
});
