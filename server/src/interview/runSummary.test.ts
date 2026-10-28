import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { RunResponse } from "@rehearse/shared";
import { runResultMessage } from "./runSummary.js";

describe("runResultMessage", () => {
  it("summarizes a compile error with the compiler output, trimmed", () => {
    const res: RunResponse = {
      mode: "run",
      verdict: "compile_error",
      passed: 0,
      total: 2,
      compileError:
        "Main.java:3: error: ';' expected\n    return 1\n            ^\n" + "x".repeat(2000),
      cases: [],
    };
    const text = runResultMessage(res, "java", 12.4);
    assert.match(
      text,
      /^Test run \(Run, about 12 min in\): the candidate ran their java code against the 2 visible cases\. 0 of 2 passed\./,
    );
    assert.match(text, /It didn't compile: Main\.java:3: error: ';' expected \| return 1/);
    assert.ok(text.length < 900, `${text.length} chars`);
  });

  it("never mentions anything about a hidden case but its status", () => {
    const res: RunResponse = {
      mode: "submit",
      verdict: "time_limit",
      passed: 0,
      total: 1,
      // even if a hidden case somehow carried details, they must not reach the interviewer
      cases: [
        {
          index: 0,
          hidden: true,
          status: "time_limit",
          runtimeMs: 5000,
          memoryKb: 1,
          input: "SECRET",
          error: "SECRET",
        },
      ],
    };
    const text = runResultMessage(res, "python", 1);
    assert.ok(!text.includes("SECRET"));
    assert.match(text, /Hidden cases: 1 hit the time limit\./);
  });

  it("caps long error text", () => {
    const res: RunResponse = {
      mode: "run",
      verdict: "runtime_error",
      passed: 0,
      total: 1,
      cases: [
        {
          index: 0,
          hidden: false,
          status: "runtime_error",
          runtimeMs: 1,
          memoryKb: 1,
          input: 's = "a"',
          error: "Traceback\n" + "y".repeat(5000),
        },
      ],
    };
    assert.ok(runResultMessage(res, "python", 1).length < 700);
  });
});
