import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type Anthropic from "@anthropic-ai/sdk";
import {
  assembleReport,
  ReportGenerationError,
  writeReportDraft,
  type CallModel,
  type ModelTurn,
} from "./generate.js";
import { fixtureRecord, goodDraft, T0 } from "./testing/fixture.js";

// a model that answers from a script and records what it was sent
function scripted(...turns: (string | ModelTurn)[]) {
  const calls: Anthropic.Beta.BetaMessageParam[][] = [];
  const callModel: CallModel = async ({ messages }) => {
    calls.push(structuredClone(messages));
    const next = turns[calls.length - 1];
    if (next === undefined) throw new Error("script ran out");
    if (typeof next !== "string") return next;
    return {
      stopReason: "end_turn",
      text: next,
      content: [{ type: "text", text: next, citations: null }] as Anthropic.Beta.BetaContentBlock[],
    };
  };
  return { callModel, calls };
}

const quiet = () => {};
const good = JSON.stringify(goodDraft());

describe("writeReportDraft", () => {
  it("returns the first report that passes every check", async () => {
    const { callModel, calls } = scripted(good);
    const { draft, attempts } = await writeReportDraft({
      record: fixtureRecord(),
      callModel,
      log: quiet,
    });
    assert.equal(attempts, 1);
    assert.equal(draft.overallScore, 66);
    assert.match(
      String(calls[0]![0]!.content),
      /<interview_record>[\s\S]*Write the feedback report for this interview\./,
    );
  });

  it("retries malformed output, sending back exactly what to fix", async () => {
    const fabricated = goodDraft();
    fabricated.categories[0]!.evidence = ["I love edge cases"];
    const { callModel, calls } = scripted(
      '{"overallScore": 66, "verdict": "Solid', // cut-off JSON
      JSON.stringify({ ...goodDraft(), categories: [] }), // wrong shape
      JSON.stringify(fabricated), // made-up quote
      good,
    );
    const { attempts } = await writeReportDraft({
      record: fixtureRecord(),
      callModel,
      maxAttempts: 4,
      log: quiet,
    });
    assert.equal(attempts, 4);

    const fixRequests = calls.slice(1).map((c) => String(c.at(-1)!.content));
    assert.match(fixRequests[0]!, /isn't valid JSON/);
    assert.match(fixRequests[1]!, /categories: /);
    assert.match(
      fixRequests[2]!,
      /communication evidence "I love edge cases" isn't something the candidate said or wrote/,
    );
    // append-only: each retry keeps the model's previous turn, unchanged, before the fix request
    assert.equal(calls[3]!.length, 7);
    assert.equal(calls[3]![5]!.role, "assistant");
  });

  it("gives up after the last attempt, keeping the problems for the log", async () => {
    const { callModel } = scripted("nope", "still nope", "nope again");
    await assert.rejects(
      writeReportDraft({ record: fixtureRecord(), callModel, log: quiet }),
      (err: unknown) => {
        assert.ok(err instanceof ReportGenerationError);
        assert.match(err.message, /after 3 attempts/);
        assert.match(err.problems[0]!, /isn't valid JSON/);
        return true;
      },
    );
  });

  it("treats a truncated response as something to fix", async () => {
    const { callModel, calls } = scripted(
      { stopReason: "max_tokens", text: '{"overall', content: [] },
      good,
    );
    await writeReportDraft({ record: fixtureRecord(), callModel, log: quiet });
    assert.match(String(calls[1]!.at(-1)!.content), /cut off/);
  });

  it("stops at a refusal instead of retrying", async () => {
    const { callModel, calls } = scripted({ stopReason: "refusal", text: null, content: [] }, good);
    await assert.rejects(
      writeReportDraft({ record: fixtureRecord(), callModel, log: quiet }),
      /declined/,
    );
    assert.equal(calls.length, 1);
  });

  it("doesn't call the model for an interview with nothing in it", async () => {
    const { callModel, calls } = scripted(good);
    const empty = fixtureRecord({
      transcript: [{ id: "a", role: "interviewer", at: 1, text: "Hi" }],
      snapshots: [],
    });
    await assert.rejects(
      writeReportDraft({ record: empty, callModel, log: quiet }),
      /isn't enough in this interview/,
    );
    assert.equal(calls.length, 0);
  });
});

describe("assembleReport", () => {
  it("fills in what the server knows for certain", () => {
    const report = assembleReport(
      fixtureRecord({ hints: [{ number: 1, at: 5, via: "voice" }] }),
      goodDraft(),
      1860,
    );
    assert.equal(report.id, "sess-1");
    assert.equal(report.problemTitle, "Merge Meeting Slots");
    assert.equal(report.date, new Date(T0).toISOString());
    assert.equal(report.language, "python");
    assert.deepEqual(report.stats, {
      hintsUsed: 1,
      hintsTotal: 3,
      testsPassedOnSubmit: 8,
      testsTotal: 8,
      runsBeforeSubmit: 0,
    });
    assert.deepEqual(
      report.categories.map((c) => c.label),
      ["Communication", "Problem Solving", "Code Quality", "Complexity Analysis"],
    );
    assert.deepEqual(
      report.moments.map((m) => [m.id, m.at]),
      [
        ["m1", 40],
        ["m2", 150],
        ["m3", 900],
      ],
    );
  });
});
