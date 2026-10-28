"use client";

import { Button } from "@/components/ui/Button";
import { useReportViewer } from "./ReportViewerProvider";

export function ReviewTranscriptButton() {
  const viewer = useReportViewer();
  return (
    <Button size="lg" onClick={(e) => viewer.open({ type: "transcript" }, e.currentTarget)}>
      Review transcript
    </Button>
  );
}
