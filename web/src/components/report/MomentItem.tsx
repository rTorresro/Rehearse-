"use client";

import type { KeyMoment } from "@rehearse/shared";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { formatClock } from "@/lib/format";
import { MomentTag } from "./MomentTag";
import { useReportViewer } from "./ReportViewerProvider";

export function MomentItem({ moment }: { moment: KeyMoment }) {
  const viewer = useReportViewer();
  const clock = formatClock(moment.at);
  const { ref } = moment;

  return (
    <Card
      as="li"
      radius="md"
      border={moment.kind === "needs-work" ? "warn" : "default"}
      className="flex flex-wrap items-start gap-x-5 gap-y-3 px-[18px] py-4"
    >
      <time
        dateTime={`PT${Math.floor(moment.at / 60)}M${moment.at % 60}S`}
        className="shrink-0 basis-14 pt-0.5 font-mono text-sm text-fg-2"
      >
        {clock}
      </time>
      <div className="flex min-w-0 flex-[1_1_360px] flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2.5">
          <MomentTag kind={moment.kind} />
          <h3 className="text-sm font-semibold">{moment.title}</h3>
        </div>
        <p className="text-[13.5px] leading-[1.55] text-fg-2">{moment.description}</p>
      </div>
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={(e) =>
            viewer.open(
              ref.type === "transcript"
                ? { type: "transcript", fromLine: ref.fromLine, toLine: ref.toLine }
                : { type: "transcript", at: moment.at },
              e.currentTarget,
            )
          }
        >
          Transcript<span className="sr-only"> at {clock}</span>
        </Button>
        {ref.type === "code" && (
          <Button
            size="sm"
            variant="accent-outline"
            onClick={(e) => viewer.open({ type: "code", version: ref.version }, e.currentTarget)}
          >
            Code v{ref.version}
            <span className="sr-only"> at {clock}</span>
          </Button>
        )}
      </div>
    </Card>
  );
}
