import type { CaseStatus, FunctionSignature, RunResponse, TestCase } from "@rehearse/shared";

export type RowStatus = CaseStatus | "pending" | "running";

// one row in the test panel, whether or not anything has run yet
export type TestRow = {
  key: string;
  // "Case 2" for visible cases; hidden ones are numbered separately so their position
  // in the list says nothing
  label: string;
  hidden: boolean;
  status: RowStatus;
  input?: string;
  expected?: string;
  actual?: string;
  error?: string;
  runtimeMs?: number | null;
};

const show = (v: unknown) => JSON.stringify(v);

// "slots = [[1,3]], k = 2", the way the examples read
export function formatArgs(signature: FunctionSignature, args: unknown[]) {
  return signature.params.map((p, i) => `${p.name} = ${show(args[i])}`).join(", ");
}

// the visible tests, before a run or while one is going
export function idleRows(
  sig: FunctionSignature,
  tests: TestCase[],
  status: "pending" | "running",
): TestRow[] {
  return tests.map((t, i) => ({
    key: `v${i}`,
    label: `Case ${i + 1}`,
    hidden: false,
    status,
    input: formatArgs(sig, t.args),
    expected: show(t.expected),
  }));
}

export function resultRows(res: RunResponse): TestRow[] {
  let visible = 0;
  let hidden = 0;
  return res.cases.map((c) => ({
    key: `c${c.index}`,
    label: c.hidden ? `Hidden case ${++hidden}` : `Case ${++visible}`,
    hidden: c.hidden,
    status: c.status,
    input: c.input,
    expected: c.expected,
    actual: c.actual,
    error: c.error,
    runtimeMs: c.runtimeMs,
  }));
}

export const VERDICT_LABEL: Record<RunResponse["verdict"], string> = {
  accepted: "Accepted",
  wrong_answer: "Wrong answer",
  compile_error: "Compile error",
  runtime_error: "Runtime error",
  time_limit: "Time limit exceeded",
  memory_limit: "Memory limit exceeded",
  output_limit: "Too much output",
  internal_error: "Runner error",
};

// what goes in the Console tab: compiler output, then what each visible case printed or threw
export function consoleLines(res: RunResponse | null): string[] {
  if (!res) return [];
  if (res.compileError) return ["Compilation failed:", ...res.compileError.split("\n")];
  let n = 0;
  return res.cases.flatMap((c) => {
    if (c.hidden) return [];
    n++;
    const out: string[] = [];
    if (c.stdout) out.push(`Case ${n} printed:`, ...c.stdout.split("\n"));
    if (c.error && c.status !== "failed") out.push(`Case ${n} error:`, ...c.error.split("\n"));
    return out.length ? [...out, ""] : [];
  });
}
