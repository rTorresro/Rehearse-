// against the real Claude API. off by default because it spends money:
//   ANTHROPIC_LIVE=1 npx tsx --test src/feedback/anthropic.live.test.ts   (in server/)
// uses ANTHROPIC_API_KEY, or an `ant auth login` profile, plus FEEDBACK_MODEL / FEEDBACK_EFFORT
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { env } from "../env.js";
import { anthropicCaller } from "./anthropic.js";
import { assembleReport, writeReportDraft } from "./generate.js";
import { fixtureRecord } from "./testing/fixture.js";

const live = process.env.ANTHROPIC_LIVE === "1";

describe(
  "feedback report (live)",
  { skip: !live && "set ANTHROPIC_LIVE=1 to call the real API" },
  () => {
    it(
      "writes a report for a recorded interview that passes every check",
      { timeout: 10 * 60_000 },
      async () => {
        const record = fixtureRecord();
        const callModel = anthropicCaller({
          apiKey: env.anthropicApiKey,
          model: env.feedbackModel,
          effort: env.feedbackEffort,
        });
        const { draft, attempts, durationSeconds } = await writeReportDraft({ record, callModel });
        const report = assembleReport(record, draft, durationSeconds);
        console.log(
          `    ${attempts} attempt(s), overall ${report.overallScore} (${report.verdict})`,
        );
        for (const c of report.categories)
          console.log(`    ${c.label}: ${c.score} — ${c.feedback}`);
        for (const m of report.moments)
          console.log(`    ${m.at}s ${m.kind}: ${m.title} — "${m.quote}"`);
        // this interview needed a nudge on complexity and crashed a hidden test: no inflated scores
        assert.ok(report.overallScore <= 85, `overall ${report.overallScore} looks inflated`);
      },
    );
  },
);
