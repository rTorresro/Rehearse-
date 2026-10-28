// the whole path: realtime events and editor snapshots go into a live controller, the End
// button hits the real route, and the report comes back from the polling route
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { after, before, describe, it } from "node:test";
import type { InterviewReport, ReportStatusResponse, RunResponse } from "@rehearse/shared";
import { createApp } from "../app.js";
import { InterviewController } from "../interview/controller.js";
import { registry } from "../interview/registry.js";
import type { SidebandSocket } from "../interview/sideband.js";
import { newSession } from "../interview/testHelpers.js";
import type { CallModel } from "./generate.js";
import { createReportStore } from "./reports.js";
import type { ReportDraft } from "./schema.js";

const CODE = "def merge_slots(slots):\n    slots.sort()\n    return slots";

// a report that only uses what this test's interview actually contains
const draft: ReportDraft = {
  overallScore: 48,
  verdict: "Not there yet",
  summary:
    "You sorted first, which is the right start, but never merged anything and leaned on two hints.",
  categories: [
    {
      id: "communication",
      score: 55,
      feedback:
        "You said 'I'd sort by start time first' up front, which helped, but went quiet after.",
      evidence: ["I'd sort by start time first"],
    },
    {
      id: "problem-solving",
      score: 45,
      feedback: "Sorting is right, but the code returns the sorted list without merging.",
      evidence: ["return slots"],
    },
    {
      id: "code-quality",
      score: 50,
      feedback: "Short and readable, but 'slots.sort()' then 'return slots' skips the merge.",
      evidence: ["slots.sort()"],
    },
    {
      id: "complexity-analysis",
      score: 40,
      feedback: "You never discussed complexity, so there's nothing to credit here.",
      evidence: [],
    },
  ],
  moments: [
    {
      at: 1,
      kind: "strength",
      title: "Started from sorting",
      description: "Saying you'd sort first set up the right approach.",
      quote: "sort by start time",
      ref: { type: "transcript", fromLine: 2, toLine: 2 },
    },
    {
      at: 1,
      kind: "needs-work",
      title: "Returned without merging",
      description: "The function sorts and returns, so overlapping slots never merge.",
      quote: "return slots",
      ref: { type: "code", version: 1 },
    },
  ],
};

const seen: string[] = [];
const callModel: CallModel = async ({ messages }) => {
  seen.push(String(messages[0]!.content));
  const text = JSON.stringify(draft);
  return { stopReason: "end_turn", text, content: [] };
};
// how many upcoming calls should return junk
let failAttempts = 0;
const flakyModel: CallModel = async (args) => {
  if (failAttempts > 0) {
    failAttempts--;
    return { stopReason: "end_turn", text: "not json", content: [] };
  }
  return callModel(args);
};

const reports = createReportStore({ callModel: flakyModel, log: () => {} });
let server: Server;
let base: string;

before(async () => {
  server = createServer(
    createApp({
      runner: { run: async () => [] },
      limits: { cpuTimeSec: 1, wallTimeSec: 2, memoryKb: 1024, maxFileKb: 1 },
      reports,
    }),
  );
  await new Promise<void>((r) => server.listen(0, r));
  base = `http://localhost:${(server.address() as AddressInfo).port}`;
});
after(() => server.close());

// a live interview with a fake sideband we can push realtime events into
// the two transcript lines and code the canned report quotes
function sayAndWrite(controller: InterviewController, push: (e: object) => void) {
  push({ type: "conversation.item.added", item: { id: "a1", type: "message", role: "assistant" } });
  push({
    type: "response.output_audio_transcript.done",
    item_id: "a1",
    transcript: "How would you approach it?",
  });
  push({
    type: "conversation.item.added",
    item: { id: "u1", type: "message", role: "user" },
    previous_item_id: "a1",
  });
  push({
    type: "conversation.item.input_audio_transcription.completed",
    item_id: "u1",
    transcript: "I'd sort by start time first.",
  });
  controller.receiveCode({ version: 1, timestamp: Date.now(), language: "python", code: CODE });
}

async function liveInterview(id: string) {
  let push: (e: object) => void = () => {};
  const socket: SidebandSocket = {
    send: () => {},
    close: () => {},
    onMessage: (cb) => (push = (e) => cb(JSON.stringify(e))),
    onClose: () => {},
  };
  const controller = new InterviewController(
    { ...newSession(), id },
    {
      log: () => {},
      codeForwardMs: 0,
      onEnded: (record) => {
        registry.delete(id);
        reports.start(record);
      },
    },
  );
  registry.set(id, controller);
  await controller.attach("rtc_x", async () => socket);
  return { controller, push };
}

const poll = async (id: string) => {
  for (let i = 0; i < 200; i++) {
    const body = (await (await fetch(`${base}/api/reports/${id}`)).json()) as ReportStatusResponse;
    if (body.status !== "generating") return body;
    await new Promise((r) => setTimeout(r, 10));
  }
  throw new Error("report never settled");
};

describe("ending an interview writes its report", () => {
  it("records the interview, ends it from the route, and serves the report", async () => {
    const { controller, push } = await liveInterview("life-1");
    push({
      type: "conversation.item.added",
      item: { id: "a1", type: "message", role: "assistant" },
    });
    push({
      type: "response.output_audio_transcript.done",
      item_id: "a1",
      transcript: "How would you approach it?",
    });
    push({
      type: "conversation.item.added",
      item: { id: "u1", type: "message", role: "user" },
      previous_item_id: "a1",
    });
    push({
      type: "conversation.item.input_audio_transcription.completed",
      item_id: "u1",
      transcript: "I'd sort by start time first.",
    });
    controller.receiveCode({ version: 1, timestamp: Date.now(), language: "python", code: CODE });
    controller.requestHint();
    push({
      type: "response.done",
      response: {
        id: "r1",
        output: [{ type: "function_call", name: "give_hint", arguments: "{}", call_id: "c1" }],
      },
    });
    const run: RunResponse = {
      mode: "run",
      verdict: "wrong_answer",
      passed: 0,
      total: 2,
      cases: [],
    };
    controller.receiveRunResult(run, "python");

    const res = await fetch(`${base}/api/realtime/session/life-1/end`, { method: "POST" });
    assert.deepEqual(await res.json(), { reportId: "life-1" });
    assert.equal(registry.get("life-1"), undefined, "the live interview is gone");

    const body = await poll("life-1");
    assert.equal(body.status, "ready", JSON.stringify(body));
    const report = (body as { report: InterviewReport }).report;
    assert.equal(report.overallScore, 48);
    assert.deepEqual(report.stats, {
      hintsUsed: 2,
      hintsTotal: 3,
      testsPassedOnSubmit: 0,
      testsTotal: 8,
      runsBeforeSubmit: 1,
    });

    // what the model was given came from the live interview
    const doc = seen.at(-1)!;
    assert.match(
      doc,
      /\[L1 00:00\] Interviewer: How would you approach it\?\n\[L2 00:00\] Candidate: I'd sort by start time first\./,
    );
    assert.match(doc, /### v1 at 00:00 \(python\), full file:\n1\| def merge_slots/);
    assert.match(doc, /Hint 1 at 00:00, asked with the hint button/);
    assert.match(doc, /Hint 2 at 00:00, asked out loud/);
    assert.match(doc, /### 1\. at 00:00 on code v1\nTest run \(Run/);
  });

  it("writes the report only once, however many ways it ends", async () => {
    const { controller, push } = await liveInterview("life-2");
    sayAndWrite(controller, push);
    const before = seen.length;
    controller.dispose(); // the call dropped
    await fetch(`${base}/api/realtime/session/life-2/end`, { method: "POST" }); // then they clicked End
    assert.equal((await poll("life-2")).status, "ready");
    assert.equal(seen.length, before + 1, "one model call, one report");
  });

  it("explains a too-short interview instead of calling the model", async () => {
    const { controller } = await liveInterview("life-3");
    const before = seen.length;
    controller.end();
    const body = await poll("life-3");
    assert.equal(body.status, "failed");
    assert.match((body as { error: string }).error, /isn't enough in this interview/);
    assert.equal(seen.length, before);
  });

  it("marks a report failed after its attempts run out, and can retry it", async () => {
    const { controller, push } = await liveInterview("life-4");
    sayAndWrite(controller, push);
    failAttempts = 3;
    controller.end();
    const failed = await poll("life-4");
    assert.equal(failed.status, "failed");
    assert.match(
      (failed as { error: string }).error,
      /Couldn't produce a valid report after 3 attempts/,
    );

    const retry = await fetch(`${base}/api/reports/life-4/retry`, { method: "POST" });
    assert.equal(retry.status, 202);
    assert.equal((await poll("life-4")).status, "ready");
    assert.equal(
      (await fetch(`${base}/api/reports/life-4/retry`, { method: "POST" })).status,
      409,
      "only failed reports retry",
    );
    assert.equal((await fetch(`${base}/api/reports/nobody/retry`, { method: "POST" })).status, 404);
    assert.equal((await fetch(`${base}/api/reports/nobody`)).status, 404);
  });
});
