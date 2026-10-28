import type { ReportStats } from "@rehearse/shared";
import { Card } from "@/components/ui/Card";
import { ScoreRing } from "./ScoreRing";

type Props = { score: number; verdict: string; summary: string; stats: ReportStats };

export function OverallScoreCard({ score, verdict, summary, stats }: Props) {
  const rows = [
    ["Hints used", `${stats.hintsUsed} of ${stats.hintsTotal}`],
    ["Tests passed on submit", `${stats.testsPassedOnSubmit} of ${stats.testsTotal}`],
    ["Runs before submit", String(stats.runsBeforeSubmit)],
  ];

  return (
    <Card
      as="section"
      label="Overall score"
      className="flex max-w-[360px] flex-[1_1_300px] flex-col items-center gap-5 px-6 py-7"
    >
      <ScoreRing score={score} />
      <div className="flex flex-col gap-1.5 text-center">
        <h2 className="text-base font-semibold">{verdict}</h2>
        <p className="text-[13.5px] leading-[1.55] text-fg-2">{summary}</p>
      </div>
      <dl className="flex flex-col gap-2.5 self-stretch border-t border-line pt-4 text-[13px]">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between">
            <dt className="text-muted">{label}</dt>
            <dd className="font-mono">{value}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}
