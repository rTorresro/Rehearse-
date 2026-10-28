import type { InterviewReport } from "@rehearse/shared";
import { CategoryCard } from "./CategoryCard";
import { MomentsTimeline } from "./MomentsTimeline";
import { OverallScoreCard } from "./OverallScoreCard";
import { ReportHeader } from "./ReportHeader";
import { ReportViewerProvider, type ReportSource } from "./ReportViewerProvider";

// the report itself, whether it came from the server or is the built-in sample
export function ReportContent({
  report,
  source,
}: {
  report: InterviewReport;
  source: ReportSource;
}) {
  return (
    <ReportViewerProvider source={source}>
      <ReportHeader report={report} />
      <div className="flex flex-wrap items-stretch gap-5">
        <OverallScoreCard
          score={report.overallScore}
          verdict={report.verdict}
          summary={report.summary}
          stats={report.stats}
        />
        <div className="flex min-w-0 flex-[3_1_560px] flex-wrap gap-5">
          {report.categories.map((c) => (
            <CategoryCard key={c.id} category={c} />
          ))}
        </div>
      </div>
      <MomentsTimeline moments={report.moments} />
    </ReportViewerProvider>
  );
}
