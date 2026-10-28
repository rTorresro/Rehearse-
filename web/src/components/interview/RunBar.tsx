import { Button } from "@/components/ui/Button";
import { PlayFilledIcon } from "@/components/ui/icons";

type Props = {
  status: string;
  busy: "run" | "submit" | null;
  onRun: () => void;
  onSubmit: () => void;
};

export function RunBar({ status, busy, onRun, onSubmit }: Props) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2.5 border-y border-line bg-surface-1 px-4 py-2.5">
      <p className="font-mono text-xs text-muted">{status}</p>
      <div className="flex gap-2.5">
        <Button
          onClick={onRun}
          disabled={busy !== null}
          aria-keyshortcuts="Control+Enter Meta+Enter"
        >
          <PlayFilledIcon className="h-[13px] w-[13px]" />
          {busy === "run" ? "Running..." : "Run"}
        </Button>
        <Button variant="primary" pad="wide" onClick={onSubmit} disabled={busy !== null}>
          {busy === "submit" ? "Submitting..." : "Submit"}
        </Button>
      </div>
    </div>
  );
}
