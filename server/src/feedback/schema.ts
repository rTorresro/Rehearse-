import * as z from "zod";
import type { InterviewRecord } from "./record.js";

export const CATEGORY_IDS = [
  "communication",
  "problem-solving",
  "code-quality",
  "complexity-analysis",
] as const;

// something the candidate said or wrote, word for word. checked against the record below
const Quote = z.string().min(3).max(400);

const MomentRef = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("transcript"),
    fromLine: z.int().min(1),
    toLine: z.int().min(1),
  }),
  z.object({ type: z.literal("code"), version: z.int().min(1) }),
]);

// what the model writes. the server adds everything it already knows for sure (problem,
// dates, stats) when it turns this into an InterviewReport
export const ReportDraftSchema = z.object({
  overallScore: z.int().min(0).max(100),
  verdict: z.string().min(3).max(40),
  summary: z.string().min(40).max(600),
  categories: z
    .array(
      z.object({
        id: z.enum(CATEGORY_IDS),
        score: z.int().min(0).max(100),
        feedback: z.string().min(40).max(1200),
        evidence: z.array(Quote).max(4),
      }),
    )
    .length(4),
  moments: z
    .array(
      z.object({
        at: z.int().min(0),
        kind: z.enum(["strength", "needs-work"]),
        title: z.string().min(5).max(80),
        description: z.string().min(20).max(400),
        quote: Quote,
        ref: MomentRef,
      }),
    )
    .min(2)
    .max(10),
});

export type ReportDraft = z.infer<typeof ReportDraftSchema>;

// scores without evidence can't be high: nothing to base them on
export const NO_EVIDENCE_CAP = 40;
// problem solving drops with every hint used, and caps if nothing ever passed on submit
export const HINT_CAPS = [100, 85, 75, 65];
export const NO_PASSING_SUBMIT_CAP = 70;
// overall has to track the categories, within this many points of their average
export const OVERALL_TOLERANCE = 10;

// lowercase, straight quotes, single spaces: transcripts and models disagree on all three
const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[‘’“”"'`]/g, "")
    .replace(/\s+/g, " ")
    .trim();

// a quote may skip words with "..." but every fragment has to really be there
function quoteFound(quote: string, haystacks: string[]) {
  const fragments = quote
    .split(/\.\.\.|…/)
    .map(norm)
    .filter((f) => f.length >= 3);
  if (fragments.length === 0) return false;
  return fragments.every((f) => haystacks.some((h) => h.includes(f)));
}

// rules the schema can't express. each message is written so it can go straight back to the
// model as something to fix
export function checkDraft(
  draft: ReportDraft,
  record: InterviewRecord,
  durationSeconds: number,
): string[] {
  const problems: string[] = [];
  // only the candidate's own words and code count as evidence; the interviewer's don't
  const sources = [
    ...record.transcript.filter((l) => l.role === "candidate").map((l) => norm(l.text)),
    ...record.snapshots.map((s) => norm(s.code)),
  ];
  const lines = record.transcript.length;
  const versions = new Set(record.snapshots.map((s) => s.version));

  const ids = draft.categories.map((c) => c.id);
  for (const id of CATEGORY_IDS) {
    if (ids.filter((x) => x === id).length !== 1)
      problems.push(`categories must contain "${id}" exactly once`);
  }

  for (const c of draft.categories) {
    for (const q of c.evidence) {
      if (!quoteFound(q, sources)) {
        problems.push(
          `${c.id} evidence "${q}" isn't something the candidate said or wrote. Quote them exactly, or drop it`,
        );
      }
    }
    if (c.evidence.length === 0 && c.score > NO_EVIDENCE_CAP) {
      problems.push(
        `${c.id} scores ${c.score} with no evidence. Quote what it's based on, or score it ${NO_EVIDENCE_CAP} or lower`,
      );
    }
  }

  const solving = draft.categories.find((c) => c.id === "problem-solving");
  if (solving) {
    const hintCap = HINT_CAPS[Math.min(record.hints.length, HINT_CAPS.length - 1)]!;
    if (solving.score > hintCap) {
      problems.push(
        `problem-solving scores ${solving.score}, but with ${record.hints.length} hint(s) used it can be at most ${hintCap}`,
      );
    }
    const passedSubmit = record.runs.some(
      (r) => r.mode === "submit" && r.result.verdict === "accepted",
    );
    if (!passedSubmit && solving.score > NO_PASSING_SUBMIT_CAP) {
      problems.push(
        `problem-solving scores ${solving.score}, but no submission ever passed every test, so it can be at most ${NO_PASSING_SUBMIT_CAP}`,
      );
    }
  }

  if (draft.categories.length > 0) {
    const mean = draft.categories.reduce((s, c) => s + c.score, 0) / draft.categories.length;
    if (Math.abs(draft.overallScore - mean) > OVERALL_TOLERANCE) {
      problems.push(
        `overallScore ${draft.overallScore} is too far from the category average ${Math.round(mean)}; keep it within ${OVERALL_TOLERANCE} points`,
      );
    }
  }

  draft.moments.forEach((m, i) => {
    const label = `moment ${i + 1} ("${m.title}")`;
    if (!quoteFound(m.quote, sources)) {
      problems.push(
        `${label} quote "${m.quote}" isn't something the candidate said or wrote. Quote them exactly`,
      );
    }
    if (m.at > durationSeconds + 30)
      problems.push(`${label} is at ${m.at}s, after the interview ended at ${durationSeconds}s`);
    if (m.ref.type === "transcript") {
      const { fromLine, toLine } = m.ref;
      if (fromLine > toLine || toLine > lines) {
        problems.push(
          `${label} points at transcript lines L${fromLine}-L${toLine}, but the transcript has L1-L${lines}`,
        );
      } else if (toLine - fromLine > 12) {
        problems.push(
          `${label} points at ${toLine - fromLine + 1} transcript lines; narrow it to the part that matters`,
        );
      }
    } else if (!versions.has(m.ref.version)) {
      problems.push(
        `${label} points at code v${m.ref.version}, which doesn't exist. Versions are ${[...versions].join(", ") || "none"}`,
      );
    }
  });

  return problems;
}
