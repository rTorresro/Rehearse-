import Anthropic from "@anthropic-ai/sdk";
import type { ReportHistory, ReportStatusResponse } from "@rehearse/shared";
import {
  assembleReport,
  ReportGenerationError,
  writeReportDraft,
  type CallModel,
} from "./generate.js";
import type { InterviewRecord } from "./record.js";

type Entry =
  | { status: "generating"; record: InterviewRecord }
  | {
      status: "ready";
      record: InterviewRecord;
      response: ReportStatusResponse & { status: "ready" };
    }
  | { status: "failed"; record: InterviewRecord; error: string };

// what to tell the candidate when it fails. the details go to the server log
function explain(err: unknown) {
  if (err instanceof ReportGenerationError) return err.message;
  if (err instanceof Anthropic.AuthenticationError)
    return "The server isn't set up to write feedback yet (no Anthropic API key).";
  if (err instanceof Anthropic.RateLimitError)
    return "The feedback model is busy right now. Try again in a minute.";
  if (err instanceof Anthropic.APIError)
    return "The feedback model is unavailable right now. Try again in a minute.";
  // raised before any request went out: the client itself isn't configured, usually no credentials
  if (err instanceof Anthropic.AnthropicError) {
    return "The server isn't set up to write feedback yet (no Anthropic credentials).";
  }
  return "Something went wrong writing your feedback. Try again.";
}

// reports by interview session id, written in the background once an interview ends.
// in memory like the rest, so a restart loses them
export function createReportStore(deps: { callModel: CallModel; log?: (msg: string) => void }) {
  const log = deps.log ?? console.log;
  const entries = new Map<string, Entry>();

  async function write(record: InterviewRecord) {
    const id = record.sessionId;
    entries.set(id, { status: "generating", record });
    try {
      const { draft, attempts, durationSeconds } = await writeReportDraft({
        record,
        callModel: deps.callModel,
        log,
      });
      const report = assembleReport(record, draft, durationSeconds);
      entries.set(id, { status: "ready", record, response: { status: "ready", report } });
      log(
        `[feedback ${id}] report ready after ${attempts} attempt(s), overall ${report.overallScore}`,
      );
    } catch (err) {
      console.error(
        `[feedback ${id}] failed`,
        err instanceof ReportGenerationError ? err.problems : err,
      );
      entries.set(id, { status: "failed", record, error: explain(err) });
    }
  }

  return {
    // once per interview: ending twice (button, then the call dropping) doesn't write twice
    start(record: InterviewRecord) {
      if (entries.has(record.sessionId)) return;
      void write(record);
    },
    get(id: string): ReportStatusResponse | undefined {
      const e = entries.get(id);
      if (!e) return undefined;
      if (e.status === "ready") return e.response;
      if (e.status === "failed") return { status: "failed", error: e.error };
      return { status: "generating" };
    },
    // the transcript and code the report cites, numbered the same way the model saw them
    history(id: string): ReportHistory | undefined {
      const e = entries.get(id);
      if (!e) return undefined;
      return {
        transcript: e.record.transcript.map((l, i) => ({
          line: i + 1,
          at: l.at,
          role: l.role,
          text: l.text,
        })),
        snapshots: e.record.snapshots.map(({ version, at, language, code }) => ({
          version,
          at,
          language,
          code,
        })),
      };
    },
    // only a failed report can be retried; anything else is already in hand or on its way
    retry(id: string) {
      const e = entries.get(id);
      if (e?.status !== "failed") return false;
      void write(e.record);
      return true;
    },
    // for tests: resolves once a report is no longer generating
    async settled(id: string) {
      while (entries.get(id)?.status === "generating") await new Promise((r) => setTimeout(r, 5));
      return this.get(id);
    },
  };
}

export type ReportStore = ReturnType<typeof createReportStore>;
