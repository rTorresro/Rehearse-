import assert from "node:assert/strict";
import { describe, it } from "node:test";
import Anthropic from "@anthropic-ai/sdk";
import { createReportStore } from "./reports.js";
import { fixtureRecord } from "./testing/fixture.js";

describe("report failures", () => {
  it("explains missing credentials instead of a generic error", async () => {
    const store = createReportStore({
      callModel: async () => {
        throw new Anthropic.AnthropicError("Could not resolve authentication method.");
      },
      log: () => {},
    });
    store.start(fixtureRecord());
    const status = await store.settled("sess-1");
    assert.deepEqual(status, {
      status: "failed",
      error: "The server isn't set up to write feedback yet (no Anthropic credentials).",
    });
  });
});

describe("report history", () => {
  it("returns the transcript numbered like the report cites it, and every snapshot, nothing else", async () => {
    const store = createReportStore({
      callModel: async () => ({ stopReason: "end_turn", text: "x", content: [] }),
      log: () => {},
    });
    const record = fixtureRecord({ sessionId: "hist-1" });
    store.start(record);
    const history = store.history("hist-1")!;
    assert.deepEqual(history.transcript[1], {
      line: 2,
      at: 40,
      role: "candidate",
      text: record.transcript[1]!.text,
    });
    assert.equal(history.transcript.length, record.transcript.length);
    assert.deepEqual(
      history.snapshots.map((s) => [s.version, s.at]),
      [
        [1, 600],
        [2, 1500],
      ],
    );
    assert.deepEqual(Object.keys(history).sort(), ["snapshots", "transcript"]);
    assert.equal(store.history("nobody"), undefined);
    await store.settled("hist-1");
  });
});
