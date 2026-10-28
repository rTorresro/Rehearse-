"use client";

import { useCallback, useEffect, useState } from "react";
import type { InterviewReport } from "@rehearse/shared";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { fetchReport, retryReport } from "@/lib/reportApi";
import { ReportContent } from "./ReportContent";

const POLL_MS = 2000;
// a report takes about a minute; give up waiting well after that
const GIVE_UP_MS = 5 * 60_000;

type View =
  | { kind: "loading" }
  | { kind: "ready"; report: InterviewReport }
  | { kind: "failed"; error: string }
  | { kind: "missing" };

// polls the server until the report is written, then shows it
export function ReportLoader({ id }: { id: string }) {
  const [view, setView] = useState<View>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const startedAt = Date.now();

    const tick = async () => {
      try {
        const status = await fetchReport(id);
        if (stopped) return;
        if (!status) return setView({ kind: "missing" });
        if (status.status === "ready") return setView({ kind: "ready", report: status.report });
        if (status.status === "failed") return setView({ kind: "failed", error: status.error });
      } catch {
        // a blip; the next poll will tell
      }
      if (Date.now() - startedAt > GIVE_UP_MS) {
        return setView({
          kind: "failed",
          error: "Your feedback is taking much longer than usual. Try again in a bit.",
        });
      }
      timer = setTimeout(tick, POLL_MS);
    };
    void tick();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
  }, [id, attempt]);

  const retry = useCallback(async () => {
    await retryReport(id);
    setView({ kind: "loading" });
    setAttempt((n) => n + 1);
  }, [id]);

  if (view.kind === "ready")
    return <ReportContent report={view.report} source={{ kind: "live", id }} />;

  return (
    <Card
      as="section"
      label="Feedback report"
      className="flex max-w-[640px] flex-col gap-3 px-7 py-7"
    >
      <SectionLabel>Feedback report</SectionLabel>
      {view.kind === "loading" && (
        <div role="status" className="flex flex-col gap-2">
          <h1 className="flex items-center gap-3 text-[22px] font-semibold tracking-[-0.015em]">
            Writing your feedback
            <span aria-hidden="true" className="flex gap-1">
              <span className="thinking-dot h-1.5 w-1.5 rounded-full bg-muted" />
              <span className="thinking-dot h-1.5 w-1.5 rounded-full bg-muted" />
              <span className="thinking-dot h-1.5 w-1.5 rounded-full bg-muted" />
            </span>
          </h1>
          <p className="leading-[1.65] text-fg-2">
            Going through the transcript, every version of your code, your test runs, and the hints
            you used. This usually takes about a minute.
          </p>
        </div>
      )}
      {view.kind === "failed" && (
        <div role="alert" className="flex flex-col gap-3">
          <h1 className="text-[22px] font-semibold tracking-[-0.015em]">
            Couldn&apos;t write your feedback
          </h1>
          <p className="leading-[1.65] text-fg-2">{view.error}</p>
          <div className="flex gap-2.5">
            <Button variant="primary" onClick={retry}>
              Try again
            </Button>
            <ButtonLink href="/practice">Practice again</ButtonLink>
          </div>
        </div>
      )}
      {view.kind === "missing" && (
        <div role="alert" className="flex flex-col gap-3">
          <h1 className="text-[22px] font-semibold tracking-[-0.015em]">No report here</h1>
          <p className="leading-[1.65] text-fg-2">
            This interview either never started or the server restarted since, so there&apos;s
            nothing to show.
          </p>
          <ButtonLink href="/practice" variant="primary" className="self-start">
            Start a new interview
          </ButtonLink>
        </div>
      )}
    </Card>
  );
}
