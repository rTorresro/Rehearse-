// every harness, end to end against real local compilers: correct solutions must pass every
// test case (hidden ones too), and each kind of failure must come back as the right status
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getProblem } from "@rehearse/problems";
import { LANGUAGES, type Language } from "@rehearse/shared";
import { runAgainstTests } from "./service.js";
import { LocalRunner, localLanguages } from "./testing/localRunner.js";
import { SOLUTIONS } from "./testing/solutions.js";
import type { ExecLimits } from "./types.js";

const runner = new LocalRunner();
const limits: ExecLimits = { cpuTimeSec: 3, wallTimeSec: 3, memoryKb: 256_000, maxFileKb: 1024 };
const run = (
  problemId: string,
  language: Language,
  code: string,
  mode: "run" | "submit" = "submit",
) => runAgainstTests({ runner, problem: getProblem(problemId)!, language, code, mode, limits });

for (const language of LANGUAGES) {
  describe(
    `${language} harness`,
    { skip: !localLanguages[language] && `${language} toolchain not installed` },
    () => {
      for (const [problemId, byLang] of Object.entries(SOLUTIONS)) {
        it(`passes every ${problemId} case with a correct solution`, async () => {
          const res = await run(problemId, language, byLang[language]);
          const bad = res.cases.filter((c) => c.status !== "passed");
          assert.equal(res.verdict, "accepted", JSON.stringify(bad, null, 2));
          assert.equal(res.passed, getProblem(problemId)!.testCases.length);
        });
      }
    },
  );
}

describe("grading", () => {
  const wrong = `def calm_streak(readings, k):\n    return 1\n`;

  it("run only uses visible cases; submit uses all of them", async () => {
    const problem = getProblem("calm-streak")!;
    const visible = problem.testCases.filter((t) => !t.hidden).length;
    assert.equal(
      (await run("calm-streak", "python", SOLUTIONS["calm-streak"]!.python, "run")).total,
      visible,
    );
    assert.equal(
      (await run("calm-streak", "python", SOLUTIONS["calm-streak"]!.python)).total,
      problem.testCases.length,
    );
  });

  it("shows expected vs actual for a failed visible case", async () => {
    const res = await run("calm-streak", "python", wrong, "run");
    assert.equal(res.verdict, "wrong_answer");
    const first = res.cases[0]!;
    assert.equal(first.status, "failed");
    assert.equal(first.input, "readings = [20,21,23,30,31,31,29], k = 2");
    assert.equal(first.expected, "4");
    assert.equal(first.actual, "1");
  });

  it("never reveals what's inside hidden cases", async () => {
    const res = await run("calm-streak", "python", wrong);
    const hidden = res.cases.filter((c) => c.hidden);
    assert.ok(hidden.length > 0);
    for (const c of hidden) {
      assert.deepEqual(Object.keys(c).sort(), [
        "hidden",
        "index",
        "memoryKb",
        "runtimeMs",
        "status",
      ]);
    }
    assert.ok(hidden.some((c) => c.status === "failed"));
  });

  it("reports exceptions as runtime errors, with the error message", async () => {
    const res = await run(
      "calm-streak",
      "python",
      `def calm_streak(readings, k):\n    raise ValueError("boom")\n`,
      "run",
    );
    assert.equal(res.verdict, "runtime_error");
    assert.match(res.cases[0]!.error ?? "", /ValueError: boom/);
  });

  it("stops infinite loops at the time limit", async () => {
    const res = await run(
      "calm-streak",
      "javascript",
      `function calmStreak() { while (true) {} }`,
      "run",
    );
    assert.equal(res.verdict, "time_limit");
    assert.equal(res.cases[0]!.status, "time_limit");
  });

  it("keeps debug prints separate from the return value", async () => {
    const code = `def calm_streak(readings, k):\n    print("debug", readings)\n${SOLUTIONS["calm-streak"]!.python.split("\n").slice(1).join("\n")}`;
    const res = await run("calm-streak", "python", code, "run");
    assert.equal(res.verdict, "accepted");
    assert.match(res.cases[0]!.stdout ?? "", /^debug \[20, 21/);
  });

  it("can't be fooled by printing something that looks like a result", async () => {
    const code = `def calm_streak(readings, k):\n    print("@@rehearse-result-0000@@4")\n    return -1\n`;
    const res = await run("calm-streak", "python", code, "run");
    assert.equal(res.cases[0]!.status, "failed");
    assert.equal(res.cases[0]!.actual, "-1");
  });

  it("fails a case that prints too much", async () => {
    const code = `def calm_streak(readings, k):\n    print("x" * 100000)\n    return 4\n`;
    const res = await run("calm-streak", "python", code, "run");
    assert.equal(res.cases[0]!.status, "output_limit");
  });

  it("reports compile errors once, for every case", { skip: !localLanguages.java }, async () => {
    const res = await run(
      "calm-streak",
      "java",
      `class Solution { public int calmStreak(int[] r, int k) { return 1 } }`,
      "run",
    );
    assert.equal(res.verdict, "compile_error");
    assert.match(res.compileError ?? "", /error/);
    assert.ok(res.cases.every((c) => c.status === "compile_error"));
  });

  it("accepts LeetCode-style class Solution in python", async () => {
    const code = `class Solution:\n    def calm_streak(self, readings, k):\n        return 4 if k == 2 else 3\n`;
    const res = await run("calm-streak", "python", code, "run");
    assert.equal(res.verdict, "accepted");
  });

  it("treats returning nothing as a wrong answer, not a crash", async () => {
    const res = await run("calm-streak", "javascript", `function calmStreak() {}`, "run");
    assert.equal(res.cases[0]!.status, "failed");
    assert.equal(res.cases[0]!.actual, "null");
  });
});

describe("errors point at the candidate's own line numbers", () => {
  it("python runtime errors", async () => {
    const res = await run(
      "calm-streak",
      "python",
      `def calm_streak(readings, k):\n    x = 1\n    return readings[99]\n`,
      "run",
    );
    assert.match(res.cases[0]!.error ?? "", /File "solution\.py", line 3, in calm_streak/);
  });

  it("python syntax errors count as compile errors", async () => {
    const res = await run(
      "calm-streak",
      "python",
      `def calm_streak(readings, k):\n    return (\n`,
      "run",
    );
    assert.equal(res.verdict, "compile_error");
    assert.match(res.compileError ?? "", /solution\.py/);
  });

  it("javascript runtime errors", async () => {
    const res = await run(
      "calm-streak",
      "javascript",
      `function calmStreak(readings, k) {\n  return readings.nope.length;\n}`,
      "run",
    );
    assert.match(res.cases[0]!.error ?? "", /solution\.js:2/);
  });

  it("javascript class Solution still works when run under its own file name", async () => {
    const code = `class Solution {\n  calmStreak(readings, k) { return k === 2 ? 4 : 3; }\n}`;
    assert.equal((await run("calm-streak", "javascript", code, "run")).verdict, "accepted");
  });

  it("c++ compile errors", { skip: !localLanguages.cpp }, async () => {
    const res = await run(
      "calm-streak",
      "cpp",
      `class Solution {\npublic:\n    int calmStreak(vector<int>& r, int k) { return 1 }\n};`,
      "run",
    );
    assert.equal(res.verdict, "compile_error");
    assert.match(res.compileError ?? "", /solution\.cpp:3:/);
  });

  it("java compile errors", { skip: !localLanguages.java }, async () => {
    const res = await run(
      "calm-streak",
      "java",
      `class Solution {\n    public int calmStreak(int[] r, int k) {\n        return 1\n    }\n}`,
      "run",
    );
    assert.match(res.compileError ?? "", /Main\.java:3:/);
  });
});
