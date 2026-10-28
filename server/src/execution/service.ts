import { randomBytes } from "node:crypto";
import type { Language, Problem, RunResponse } from "@rehearse/shared";
import { gradeCase, summarize } from "./grade.js";
import { buildProgram, stdinFor } from "./harness/index.js";
import type { CodeRunner, ExecLimits } from "./types.js";

// runs code against a problem's tests. the tests always come from the bank: run gets the
// visible ones, submit gets all of them, and the request only ever supplies the code
export async function runAgainstTests(args: {
  runner: CodeRunner;
  problem: Problem;
  language: Language;
  code: string;
  mode: RunResponse["mode"];
  limits: ExecLimits;
}): Promise<RunResponse> {
  const { runner, problem, language, code, mode, limits } = args;
  const tests = problem.testCases
    .map((test, index) => ({ test, index }))
    .filter(({ test }) => mode === "submit" || !test.hidden);

  // fresh per run, so printed output can't pass itself off as the return value
  const marker = `@@rehearse-result-${randomBytes(12).toString("hex")}@@`;
  const source = buildProgram(language, problem.signature, code, marker);
  const outcomes = await runner.run(
    tests.map(({ test }) => ({ language, source, stdin: stdinFor(test.args) })),
    limits,
  );

  const cases = tests.map(({ test, index }, i) =>
    gradeCase({ index, test, outcome: outcomes[i]!, marker, signature: problem.signature, limits }),
  );
  // the compiler output, taken from the runner directly: it holds no test data, and the
  // first case to report it might be a hidden one whose details get stripped
  const i = cases.findIndex((c) => c.status === "compile_error");
  const compiled = i >= 0 ? outcomes[i]! : undefined;
  return summarize(
    mode,
    cases,
    compiled && (compiled.compileOutput || compiled.stderr || compiled.message),
  );
}
