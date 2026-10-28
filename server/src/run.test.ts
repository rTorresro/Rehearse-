import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { after, before, describe, it } from "node:test";
import { getProblem } from "@rehearse/problems";
import type { RunResponse } from "@rehearse/shared";
import { createApp } from "./app.js";
import { createReportStore } from "./feedback/reports.js";
import type { CodeRunner, RunJob } from "./execution/types.js";
import type { InterviewController } from "./interview/controller.js";
import { registry } from "./interview/registry.js";

// pretends every program printed the expected answer for the args it was given,
// and remembers what it was asked to run
const seen: RunJob[][] = [];
const problem = getProblem("calm-streak")!;
const fakeRunner: CodeRunner = {
  async run(jobs) {
    seen.push(jobs);
    return jobs.map((job) => {
      const marker = job.source.match(/@@rehearse-result-[0-9a-f]+@@/)![0];
      const test = problem.testCases.find((t) => JSON.stringify(t.args) === job.stdin)!;
      return {
        status: "ok",
        stdout: `\n${marker}${JSON.stringify(test.expected)}\n`,
        stderr: "",
        compileOutput: "",
        timeMs: 12,
        memoryKb: 9000,
        message: "",
      };
    });
  },
};

let server: Server;
let base: string;
before(async () => {
  server = createServer(
    createApp({
      runner: fakeRunner,
      limits: { cpuTimeSec: 2, wallTimeSec: 4, memoryKb: 128_000, maxFileKb: 1024 },
      reports: createReportStore({
        callModel: async () => {
          throw new Error("not used");
        },
      }),
    }),
  );
  await new Promise<void>((r) => server.listen(0, r));
  base = `http://localhost:${(server.address() as AddressInfo).port}`;
});
after(() => server.close());

const post = (body: object) =>
  fetch(`${base}/api/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
const ok = { problemId: "calm-streak", language: "python", code: "def calm_streak(r, k): pass" };

describe("POST /api/run", () => {
  it("run executes the visible cases only", async () => {
    seen.length = 0;
    const res = await post({ ...ok, mode: "run" });
    assert.equal(res.status, 200);
    const body = (await res.json()) as RunResponse;
    const visible = problem.testCases.filter((t) => !t.hidden);
    assert.equal(seen[0]!.length, visible.length);
    assert.equal(body.total, visible.length);
    assert.equal(body.verdict, "accepted");
    assert.ok(body.cases.every((c) => !c.hidden && c.input && c.expected));
  });

  it("submit executes every case and hides the hidden ones' details", async () => {
    seen.length = 0;
    const body = (await (await post({ ...ok, mode: "submit" })).json()) as RunResponse;
    assert.equal(seen[0]!.length, problem.testCases.length);
    const hidden = body.cases.filter((c) => c.hidden);
    assert.equal(hidden.length, problem.testCases.filter((t) => t.hidden).length);
    for (const c of hidden)
      assert.equal(c.input ?? c.expected ?? c.actual ?? c.stdout ?? c.error, undefined);
    // and the hidden inputs never appear anywhere in the response
    const raw = JSON.stringify(body);
    for (const t of problem.testCases.filter((t) => t.hidden)) {
      assert.ok(!raw.includes(JSON.stringify(t.args[0])), `leaked ${JSON.stringify(t.args)}`);
    }
  });

  it("ignores test cases sent by the client", async () => {
    seen.length = 0;
    await post({ ...ok, mode: "submit", tests: [{ args: [[1], 0], expected: 1, hidden: false }] });
    assert.deepEqual(
      seen[0]!.map((j) => j.stdin),
      problem.testCases.map((t) => JSON.stringify(t.args)),
    );
  });

  it("rejects bad requests before running anything", async () => {
    seen.length = 0;
    for (const [body, status] of [
      [{ ...ok, mode: "run", problemId: "nope" }, 400],
      [{ ...ok, mode: "run", language: "ruby" }, 400],
      [{ ...ok, mode: "everything" }, 400],
      [{ ...ok, mode: "run", code: "   " }, 400],
      [{ ...ok, mode: "run", code: "x".repeat(50_001) }, 413],
    ] as const) {
      assert.equal((await post(body)).status, status, JSON.stringify(body).slice(0, 80));
    }
    assert.equal(seen.length, 0);
  });

  it("rate limits per client", async () => {
    let limited = 0;
    for (let i = 0; i < 25; i++) if ((await post({ ...ok, mode: "run" })).status === 429) limited++;
    assert.ok(limited > 0);
  });
});

describe("run results reach the interviewer", () => {
  it("forwards to the live interview named in the request", async () => {
    const got: RunResponse[] = [];
    registry.set("live-run", {
      receiveRunResult: (r: RunResponse) => got.push(r),
    } as unknown as InterviewController);
    // a fresh app, so the rate limit test above doesn't get in the way
    const fresh = createServer(
      createApp({
        runner: fakeRunner,
        limits: { cpuTimeSec: 2, wallTimeSec: 4, memoryKb: 128_000, maxFileKb: 1024 },
        reports: createReportStore({
          callModel: async () => {
            throw new Error("not used");
          },
        }),
      }),
    );
    await new Promise<void>((r) => fresh.listen(0, r));
    const res = await fetch(`http://localhost:${(fresh.address() as AddressInfo).port}/api/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...ok, mode: "run", sessionId: "live-run" }),
    });
    fresh.close();
    assert.equal(res.status, 200);
    assert.equal(got.length, 1);
    assert.equal(got[0]!.mode, "run");
    registry.delete("live-run");
  });

  it("ignores an unknown session", async () => {
    const res = await post({ ...ok, mode: "run", sessionId: "nobody" });
    assert.ok(res.status === 200 || res.status === 429);
  });
});
