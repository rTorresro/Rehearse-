// against a real Judge0. off by default so tests never hit a shared service by accident:
//   JUDGE0_LIVE=1 npx tsx --test src/execution/judge0.live.test.ts
// uses JUDGE0_URL etc. from the environment, falling back to the public CE instance
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getProblem } from "@rehearse/problems";
import type { Language } from "@rehearse/shared";
import { execLimits, judge0FromEnv } from "./config.js";
import { runAgainstTests } from "./service.js";
import { SOLUTIONS } from "./testing/solutions.js";

const live = process.env.JUDGE0_LIVE === "1";
const runner = judge0FromEnv();

// one problem per language, between them covering trees, strings, bools, and nested arrays
const PLAN: [Language, string][] = [
  ["python", "shipment-reconciliation"],
  ["javascript", "merge-meeting-slots"],
  ["java", "heaviest-level"],
  ["cpp", "well-nested-tags"],
];

describe(
  "Judge0 (live)",
  { skip: !live && "set JUDGE0_LIVE=1 to run against a real Judge0" },
  () => {
    for (const [language, problemId] of PLAN) {
      it(`${language}: a correct ${problemId} passes every case, hidden ones included`, async () => {
        const res = await runAgainstTests({
          runner,
          problem: getProblem(problemId)!,
          language,
          code: SOLUTIONS[problemId]![language],
          mode: "submit",
          limits: execLimits,
        });
        const bad = res.cases.filter((c) => c.status !== "passed");
        assert.equal(res.verdict, "accepted", JSON.stringify(bad, null, 2));
        console.log(
          `    ${language}: ${res.passed}/${res.total}, runtimes ${res.cases.map((c) => c.runtimeMs).join(", ")} ms`,
        );
      });
    }

    it("enforces the time limit", async () => {
      const res = await runAgainstTests({
        runner,
        problem: getProblem("calm-streak")!,
        language: "python",
        code: "def calm_streak(readings, k):\n    while True:\n        pass\n",
        mode: "run",
        limits: { ...execLimits, cpuTimeSec: 2, wallTimeSec: 4 },
      });
      assert.equal(res.verdict, "time_limit", JSON.stringify(res.cases[0]));
    });

    it("reports compile errors", async () => {
      const res = await runAgainstTests({
        runner,
        problem: getProblem("calm-streak")!,
        language: "cpp",
        code: "class Solution { public: int calmStreak(vector<int>& r, int k) { return 1 } };",
        mode: "run",
        limits: execLimits,
      });
      assert.equal(res.verdict, "compile_error");
      assert.match(res.compileError ?? "", /error/);
    });
  },
);
