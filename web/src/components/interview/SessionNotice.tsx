import { Button } from "@/components/ui/Button";
import { WarningIcon } from "@/components/ui/icons";
import type { VoiceError } from "@/lib/voice/types";

// shown in place of the mic controls when the call can't start or drops
export function SessionNotice({ error, onRetry }: { error: VoiceError; onRetry: () => void }) {
  const title =
    error.kind.startsWith("mic") || error.kind === "unsupported"
      ? "Microphone needed"
      : "Couldn't connect";

  return (
    <div
      role="alert"
      className="flex w-full flex-col gap-3 rounded-[10px] border border-danger-border bg-surface-2 px-4 py-3.5"
    >
      <p className="flex items-center gap-2 text-[13px] font-semibold text-danger-text">
        <WarningIcon className="h-4 w-4" />
        {title}
      </p>
      <p className="text-[13px] leading-normal text-fg-2">{error.message}</p>
      <Button onClick={onRetry} className="self-start">
        Try again
      </Button>
    </div>
  );
}
