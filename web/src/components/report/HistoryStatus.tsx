import { Button } from "@/components/ui/Button";
import type { HistoryState } from "./ReportViewerProvider";

// shown inside a viewer while its data loads or after it failed to
export function HistoryStatus({ state, onRetry }: { state: HistoryState; onRetry: () => void }) {
  if (state.status === "loading") {
    return (
      <p role="status" className="p-6 text-[13px] text-muted">
        Loading...
      </p>
    );
  }
  if (state.status === "error") {
    return (
      <div role="alert" className="flex flex-col items-start gap-3 p-6">
        <p className="text-[13px] text-fg-2">
          Couldn&apos;t load this interview&apos;s transcript and code.
        </p>
        <Button size="sm" onClick={onRetry}>
          Try again
        </Button>
      </div>
    );
  }
  return null;
}
