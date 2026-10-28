import type { InterviewReport } from "@rehearse/shared";
import { ButtonLink } from "@/components/ui/Button";
import { RefreshIcon } from "@/components/ui/icons";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { ReviewTranscriptButton } from "./ReviewTranscriptButton";
import { DifficultyTag } from "@/components/interview/DifficultyTag";
import { formatClock } from "@/lib/format";
import { LANGUAGE_OPTIONS } from "@/lib/languages";

// pinned to UTC + en-US so the server render is the same everywhere
const dateFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

export function ReportHeader({ report }: { report: InterviewReport }) {
  const language = LANGUAGE_OPTIONS.find((l) => l.id === report.language)?.label ?? report.language;

  return (
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
      <div className="flex flex-col gap-2">
        <SectionLabel>Feedback report</SectionLabel>
        <h1 className="text-[30px] font-semibold tracking-[-0.02em]">{report.problemTitle}</h1>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] text-fg-2">
          <DifficultyTag difficulty={report.difficulty} />
          <span>{language}</span>
          <span className="font-mono">
            <span className="sr-only">Duration </span>
            {formatClock(report.durationSeconds)}
          </span>
          <time dateTime={report.date}>{dateFormat.format(new Date(report.date))}</time>
        </div>
      </div>
      <div className="flex flex-wrap gap-2.5">
        <ReviewTranscriptButton />
        <ButtonLink href="/practice" variant="primary" size="lg" pad="wide">
          <RefreshIcon className="h-[15px] w-[15px]" />
          Practice again
        </ButtonLink>
      </div>
    </div>
  );
}
