import type { CaseResult, CaseStatus, Language, RunResponse } from "@rehearse/shared";

// how many visible cases to spell out, and how much of any error text to pass along
const MAX_CASES = 6;
const MAX_ERROR = 300;

const STATUS_WORDS: Record<CaseStatus, string> = {
  passed: "passed",
  failed: "failed",
  compile_error: "didn't compile",
  runtime_error: "crashed",
  time_limit: "hit the time limit",
  memory_limit: "hit the memory limit",
  output_limit: "printed too much",
  internal_error: "couldn't be run (a problem on our side, not theirs)",
};

const clip = (s: string, n = MAX_ERROR) => {
  const one = s.trim().replace(/\s*\n\s*/g, " | ");
  return one.length > n ? `${one.slice(0, n)}…` : one;
};

function visibleLine(c: CaseResult, n: number) {
  if (c.status === "passed") return `- Case ${n} passed (input ${c.input}).`;
  const what = STATUS_WORDS[c.status];
  if (c.status === "failed")
    return `- Case ${n} failed: input ${c.input}. Expected ${c.expected}, got ${c.actual}.`;
  return `- Case ${n} ${what}: input ${c.input}.${c.error ? ` Error: ${clip(c.error)}` : ""}`;
}

// counts per status, e.g. "4 passed, 1 failed, 1 hit the time limit"
function hiddenLine(hidden: CaseResult[]) {
  const counts = new Map<CaseStatus, number>();
  for (const c of hidden) counts.set(c.status, (counts.get(c.status) ?? 0) + 1);
  const parts = [...counts].map(([status, n]) => `${n} ${STATUS_WORDS[status]}`);
  return `Hidden cases: ${parts.join(", ")}. Neither of you can see their inputs, so don't guess at them.`;
}

// the system message the interviewer gets after every Run or Submit. built from the same
// redacted results the candidate sees, so it holds nothing about hidden cases but counts
export function runResultMessage(
  res: RunResponse,
  language: Language,
  minutesIn: number,
  // the feedback writer reads this after the fact; the on-screen note is for the live interviewer
  opts: { forReport?: boolean } = {},
) {
  const visible = res.cases.filter((c) => !c.hidden);
  const hidden = res.cases.filter((c) => c.hidden);
  const action =
    res.mode === "submit"
      ? `submitted their ${language} solution against all ${res.total} cases (${visible.length} visible, ${hidden.length} hidden)`
      : `ran their ${language} code against the ${res.total} visible cases`;

  const lines = [
    `Test run (${res.mode === "submit" ? "Submit" : "Run"}, about ${Math.floor(minutesIn)} min in): the candidate ${action}. ${res.passed} of ${res.total} passed.`,
  ];
  if (res.verdict === "compile_error") {
    lines.push(`It didn't compile: ${clip(res.compileError ?? "", 600)}`);
  } else {
    visible.slice(0, MAX_CASES).forEach((c, i) => lines.push(visibleLine(c, i + 1)));
    if (visible.length > MAX_CASES)
      lines.push(`- …and ${visible.length - MAX_CASES} more visible cases.`);
    if (hidden.length) lines.push(hiddenLine(hidden));
  }
  if (!opts.forReport)
    lines.push("They can see these results on screen too, so never read them out.");
  return lines.join("\n");
}

// asked out of band after a run: should the interviewer speak up?
export const RUN_DECISION_PROMPT = `You are helping run a live mock coding interview. The candidate just ran their code and the results are below. Decide whether the interviewer should say something right now.
Answer COMMENT if the results are worth a short reaction: a failure they may not have noticed, a crash or compile error that changes things, every test passing on a submit, or a natural moment to move the interview along.
Answer QUIET if the result is unremarkable, the candidate is clearly still working through it, or the interviewer has just been talking about it.
Reply with exactly one word: COMMENT or QUIET.`;
