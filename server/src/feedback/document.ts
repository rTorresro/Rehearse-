import { diffLines } from "../interview/codeContext.js";
import { runResultMessage } from "../interview/runSummary.js";
import type { InterviewRecord, SnapshotRecord } from "./record.js";

export const clock = (sec: number) =>
  `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;

const numbered = (code: string) => {
  const lines = code.split("\n");
  const w = String(lines.length).length;
  return lines.map((l, i) => `${String(i + 1).padStart(w)}| ${l}`).join("\n");
};

// what changed from one version to the next, with one line of context, new-file numbering
function diff(before: string, after: string) {
  const ops = diffLines(before.split("\n"), after.split("\n"));
  if (!ops) return null;
  const keep = new Set<number>();
  ops.forEach((op, i) => {
    if (op.kind !== "same") for (let k = i - 1; k <= i + 1; k++) keep.add(k);
  });
  if (keep.size === 0) return "(no changes)";
  let prev = -2;
  const out: string[] = [];
  for (const i of [...keep].filter((k) => k >= 0 && k < ops.length).sort((a, b) => a - b)) {
    if (i !== prev + 1) out.push("@@");
    const op = ops[i]!;
    out.push(
      op.kind === "del"
        ? `-    | ${op.text}`
        : `${op.kind === "add" ? "+" : " "}${String(op.newLine).padStart(4)}| ${op.text}`,
    );
    prev = i;
  }
  return out.join("\n");
}

// the first version, every language switch, and the final version go in whole; in between,
// only what changed. keeps a long session readable without losing any of it
function codeSection(snaps: SnapshotRecord[]) {
  if (snaps.length === 0) return "The candidate never wrote any code.";
  return snaps
    .map((s, i) => {
      const prev = snaps[i - 1];
      const head = `### v${s.version} at ${clock(s.at)} (${s.language})`;
      const last = i === snaps.length - 1;
      if (!prev || prev.language !== s.language) return `${head}, full file:\n${numbered(s.code)}`;
      const d = diff(prev.code, s.code);
      const changes =
        d === null
          ? `full file (too different to diff):\n${numbered(s.code)}`
          : `changes from v${prev.version}:\n${d}`;
      return last
        ? `${head}, ${changes}\n\nFinal version, full file:\n${numbered(s.code)}`
        : `${head}, ${changes}`;
    })
    .join("\n\n");
}

export type FeedbackDocument = {
  text: string;
  // 1-based, matching the [L#] labels in the text
  transcriptLines: InterviewRecord["transcript"];
  durationSeconds: number;
};

export function buildFeedbackDocument(record: InterviewRecord): FeedbackDocument {
  const { problem } = record;
  const durationSeconds = Math.max(0, Math.round((record.endedAt - record.startedAt) / 1000));
  const list = (xs: string[]) => xs.map((x) => `- ${x}`).join("\n");

  const phases = record.phases.length
    ? record.phases
        .map((p) => `${p.to} from ${clock((p.at - record.startedAt) / 1000)} (${p.reason})`)
        .join("; ")
    : "never left the intro";
  const hints = record.hints.length
    ? record.hints
        .map(
          (h) =>
            `- Hint ${h.number} at ${clock(h.at)}, asked ${h.via === "button" ? "with the hint button" : "out loud"}: ${problem.hints[h.number - 1]}`,
        )
        .join("\n")
    : "None.";
  const transcript = record.transcript.length
    ? record.transcript
        .map(
          (l, i) =>
            `[L${i + 1} ${clock(l.at)}] ${l.role === "candidate" ? "Candidate" : "Interviewer"}: ${l.text}`,
        )
        .join("\n")
    : "(nothing was said)";
  const runs = record.runs.length
    ? record.runs
        .map(
          (r, i) =>
            `### ${i + 1}. at ${clock(r.at)} on code v${r.codeVersion ?? "?"}\n${runResultMessage(r.result, r.language, r.at / 60, { forReport: true })}`,
        )
        .join("\n\n")
    : "The candidate never ran their code.";

  const text = `<interview_record>
## Problem
${problem.title} (${problem.difficulty})
${problem.statement.join("\n").replaceAll("`", "")}
Best possible complexity: ${problem.complexity.time} time, ${problem.complexity.space} space.
Common pitfalls:
${list(problem.pitfalls)}
What a strong answer shows:
${list(problem.interviewerNotes)}

## Interview
Length: ${clock(durationSeconds)}. Phases: ${phases}.
Hints used: ${record.hints.length} of ${problem.hints.length}.
${hints}

## Transcript
Speech-to-text, so expect small transcription errors. Each line is [L<line> <mm:ss>] Speaker: text.
${transcript}

## Code
${codeSection(record.snapshots)}

## Test runs
${runs}
</interview_record>`;

  return { text, transcriptLines: record.transcript, durationSeconds };
}
