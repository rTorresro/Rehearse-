import { isDeepStrictEqual } from "node:util";
import type {
  CaseResult,
  CaseStatus,
  FunctionSignature,
  RunResponse,
  RunVerdict,
  TestCase,
} from "@rehearse/shared";
import type { ExecLimits, RunOutcome } from "./types.js";

// printing more than this fails the case: almost always a runaway loop
export const OUTPUT_LIMIT_CHARS = 64 * 1024;
// longest stdout, error, or value we send back for display
export const DISPLAY_CHARS = 2000;

const clip = (s: string, n = DISPLAY_CHARS) =>
  s.length > n ? `${s.slice(0, n)}\n… (truncated)` : s;
// errors are most useful at the end: the exception line comes last in a traceback
const tail = (s: string, n = DISPLAY_CHARS) => (s.length > n ? `…\n${s.slice(-n)}` : s);

export function formatArgs(sig: FunctionSignature, args: unknown[]) {
  return sig.params.map((p, i) => `${p.name} = ${JSON.stringify(args[i])}`).join(", ");
}

// runtime errors that are really the memory limit
function looksLikeMemory(outcome: RunOutcome, limits: ExecLimits) {
  return (
    /MemoryError|OutOfMemoryError|bad_alloc|JavaScript heap out of memory|Cannot allocate memory/.test(
      outcome.stderr,
    ) ||
    (outcome.memoryKb !== null && outcome.memoryKb >= limits.memoryKb * 0.95)
  );
}

type Graded = { status: CaseStatus; actual?: string; stdout?: string; error?: string };

function judge(outcome: RunOutcome, test: TestCase, marker: string, limits: ExecLimits): Graded {
  switch (outcome.status) {
    case "compile_error":
      return { status: "compile_error", error: tail(outcome.compileOutput || outcome.message) };
    case "time_limit":
      return { status: "time_limit", error: `Took longer than ${limits.cpuTimeSec}s of CPU time` };
    case "memory_limit":
      return {
        status: "memory_limit",
        error: `Used more than ${Math.round(limits.memoryKb / 1024)} MB`,
      };
    case "internal_error":
      return { status: "internal_error", error: outcome.message };
    case "runtime_error":
      // python and javascript only find syntax errors when they run, but it's a compile error
      if (/\b(SyntaxError|IndentationError|TabError)\b/.test(outcome.stderr)) {
        return { status: "compile_error", error: tail(outcome.stderr) };
      }
      return looksLikeMemory(outcome, limits)
        ? {
            status: "memory_limit",
            error: `Used more than ${Math.round(limits.memoryKb / 1024)} MB`,
          }
        : {
            status: "runtime_error",
            error: tail(outcome.stderr || outcome.message),
            stdout: clip(outcome.stdout),
          };
  }

  if (outcome.stdout.length > OUTPUT_LIMIT_CHARS) {
    return { status: "output_limit", error: `Printed more than ${OUTPUT_LIMIT_CHARS / 1024} KB` };
  }
  const at = outcome.stdout.lastIndexOf(marker);
  if (at < 0) {
    // the function never returned normally, e.g. they called exit()
    return {
      status: "runtime_error",
      error: "Your code exited before returning a value",
      stdout: clip(outcome.stdout),
    };
  }
  const printed = outcome.stdout.slice(0, at).replace(/\n$/, "");
  const raw = outcome.stdout.slice(at + marker.length).trim();
  let actual: unknown;
  try {
    actual = JSON.parse(raw);
  } catch {
    return {
      status: "runtime_error",
      error: "Couldn't read your function's return value",
      stdout: clip(printed),
    };
  }
  return {
    status: isDeepStrictEqual(actual, test.expected) ? "passed" : "failed",
    actual: clip(JSON.stringify(actual)),
    stdout: printed ? clip(printed) : undefined,
  };
}

export function gradeCase(args: {
  index: number;
  test: TestCase;
  outcome: RunOutcome;
  marker: string;
  signature: FunctionSignature;
  limits: ExecLimits;
}): CaseResult {
  const { index, test, outcome, marker, signature, limits } = args;
  const graded = judge(outcome, test, marker, limits);
  const base: CaseResult = {
    index,
    hidden: test.hidden,
    status: graded.status,
    runtimeMs: outcome.timeMs,
    memoryKb: outcome.memoryKb,
  };
  // hidden cases say how it went, never what was in them
  if (test.hidden) return base;
  return {
    ...base,
    input: clip(formatArgs(signature, test.args)),
    expected: clip(JSON.stringify(test.expected)),
    ...(graded.actual !== undefined && { actual: graded.actual }),
    ...(graded.stdout && { stdout: graded.stdout }),
    ...(graded.error && { error: graded.error }),
  };
}

// the overall result: accepted only if every case passed, otherwise named after the first
// case that didn't
export function summarize(
  mode: RunResponse["mode"],
  cases: CaseResult[],
  // straight from the compiler, not from a case: it holds no test data, and the first
  // case to report it might be hidden
  compileOutput?: string,
): RunResponse {
  const passed = cases.filter((c) => c.status === "passed").length;
  const firstBad = cases.find((c) => c.status !== "passed");
  const verdict: RunVerdict = !firstBad
    ? "accepted"
    : firstBad.status === "failed"
      ? "wrong_answer"
      : (firstBad.status as RunVerdict);
  return {
    mode,
    verdict,
    passed,
    total: cases.length,
    ...(verdict === "compile_error" && {
      compileError: tail(compileOutput || "Compilation failed"),
    }),
    cases,
  };
}
