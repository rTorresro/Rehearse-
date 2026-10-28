import type Anthropic from "@anthropic-ai/sdk";
import type { InterviewReport, Language } from "@rehearse/shared";
import { buildFeedbackDocument } from "./document.js";
import { RUBRIC } from "./prompt.js";
import type { InterviewRecord } from "./record.js";
import { checkDraft, ReportDraftSchema, type ReportDraft } from "./schema.js";

// one model call. injected so tests can script exactly what comes back
export type ModelTurn = {
  stopReason: string | null;
  // the JSON text the model produced, if any
  text: string | null;
  // the full response content, echoed back unchanged when asking for a fix
  content: Anthropic.Beta.BetaContentBlock[];
};
export type CallModel = (args: {
  system: string;
  messages: Anthropic.Beta.BetaMessageParam[];
}) => Promise<ModelTurn>;

export class ReportGenerationError extends Error {
  constructor(
    message: string,
    readonly problems: string[] = [],
  ) {
    super(message);
  }
}

const LABELS = {
  communication: "Communication",
  "problem-solving": "Problem Solving",
  "code-quality": "Code Quality",
  "complexity-analysis": "Complexity Analysis",
} as const;

// everything wrong with one attempt, as instructions the model can act on
function problemsWith(turn: ModelTurn, record: InterviewRecord, durationSeconds: number) {
  if (turn.stopReason === "max_tokens")
    return { problems: ["The report was cut off. Keep it more concise."] };
  if (!turn.text)
    return { problems: ["There was no report in the response. Return the report as JSON."] };
  let json: unknown;
  try {
    json = JSON.parse(turn.text);
  } catch (err) {
    return { problems: [`The report isn't valid JSON (${(err as Error).message}).`] };
  }
  const parsed = ReportDraftSchema.safeParse(json);
  if (!parsed.success) {
    return {
      problems: parsed.error.issues.map((i) => `${i.path.join(".") || "report"}: ${i.message}`),
    };
  }
  return { draft: parsed.data, problems: checkDraft(parsed.data, record, durationSeconds) };
}

// asks for a report, checks it, and asks for fixes until it passes or attempts run out
export async function writeReportDraft(args: {
  record: InterviewRecord;
  callModel: CallModel;
  maxAttempts?: number;
  log?: (msg: string) => void;
}): Promise<{ draft: ReportDraft; attempts: number; durationSeconds: number }> {
  const { record, callModel, maxAttempts = 3, log = console.log } = args;
  const candidateLines = record.transcript.filter((l) => l.role === "candidate").length;
  if (candidateLines < 2 && record.snapshots.length === 0) {
    throw new ReportGenerationError(
      "There isn't enough in this interview to give feedback on. Talk through a problem for a few minutes and try again.",
    );
  }

  const doc = buildFeedbackDocument(record);
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    { role: "user", content: `${doc.text}\n\nWrite the feedback report for this interview.` },
  ];
  let problems: string[] = [];

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const turn = await callModel({ system: RUBRIC, messages });
    if (turn.stopReason === "refusal")
      throw new ReportGenerationError("The feedback model declined to write this report.");
    const result = problemsWith(turn, record, doc.durationSeconds);
    problems = result.problems;
    if (result.draft && problems.length === 0)
      return { draft: result.draft, attempts: attempt, durationSeconds: doc.durationSeconds };

    log(`[feedback ${record.sessionId}] attempt ${attempt} rejected: ${problems.join(" | ")}`);
    // append-only: the model's own turn goes back unchanged, then what to fix
    messages.push({ role: "assistant", content: turn.content });
    messages.push({
      role: "user",
      content: `That report has problems:\n${problems.map((p) => `- ${p}`).join("\n")}\n\nFix them and return the full corrected report. Keep everything else that was right.`,
    });
  }
  throw new ReportGenerationError(
    `Couldn't produce a valid report after ${maxAttempts} attempts.`,
    problems,
  );
}

// the model's judgment plus everything the server knows for certain
export function assembleReport(
  record: InterviewRecord,
  draft: ReportDraft,
  durationSeconds: number,
): InterviewReport {
  const last = record.snapshots.at(-1);
  const language: Language = last?.language ?? record.runs.at(-1)?.language ?? "python";
  const submits = record.runs.filter((r) => r.mode === "submit");
  const lastSubmit = submits.at(-1);
  const firstSubmitIndex = record.runs.findIndex((r) => r.mode === "submit");
  const order = new Map(Object.keys(LABELS).map((id, i) => [id, i]));

  return {
    id: record.sessionId,
    problemTitle: record.problem.title,
    difficulty: record.problem.difficulty,
    language,
    date: new Date(record.startedAt).toISOString(),
    durationSeconds,
    overallScore: draft.overallScore,
    verdict: draft.verdict,
    summary: draft.summary,
    stats: {
      hintsUsed: record.hints.length,
      hintsTotal: record.problem.hints.length,
      testsPassedOnSubmit: lastSubmit?.result.passed ?? 0,
      testsTotal: record.problem.testCases.length,
      runsBeforeSubmit: firstSubmitIndex < 0 ? record.runs.length : firstSubmitIndex,
    },
    categories: [...draft.categories]
      .sort((a, b) => order.get(a.id)! - order.get(b.id)!)
      .map((c) => ({
        id: c.id,
        label: LABELS[c.id],
        score: c.score,
        feedback: c.feedback,
        evidence: c.evidence,
      })),
    moments: [...draft.moments]
      .sort((a, b) => a.at - b.at)
      .map((m, i) => ({ id: `m${i + 1}`, ...m })),
  };
}
