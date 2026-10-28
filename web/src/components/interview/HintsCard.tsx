"use client";

import { Button } from "@/components/ui/Button";
import { LockIcon } from "@/components/ui/icons";
import { useInterviewSocket } from "@/lib/interview/InterviewSocketProvider";

// the server decides which hint comes next and how many are used; this just shows it.
// hints unlock in order, by voice (the interviewer's give_hint tool) or with the button
export function HintsCard({ total }: { total: number }) {
  const sock = useInterviewSocket();
  const unlocked = sock.hints?.unlocked ?? [];
  const used = unlocked.length;
  const left = total - used;
  const live = sock.status === "live";

  return (
    <div className="mt-auto flex flex-col gap-2.5 rounded-[10px] border border-line bg-surface-2 px-4 py-3.5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-[13px] font-semibold">
          <LockIcon className="h-3.5 w-3.5 text-muted" />
          Hints
        </h2>
        <span className="text-xs text-muted">
          {used === 0 ? `${total} locked` : `${used} of ${total} used`}
        </span>
      </div>

      {used === 0 && (
        <p className="text-[13px] leading-normal text-muted">
          Ask the interviewer for a nudge to unlock the first hint. Each hint costs points in your
          feedback report.
        </p>
      )}

      {/* announced as they unlock, since the interviewer may be saying it at the same time */}
      <ol aria-live="polite" className="flex flex-col gap-2">
        {unlocked.map((h) => (
          <li key={h.number} className="rounded-lg border border-line bg-surface-1 px-3 py-[9px]">
            <span className="text-xs font-medium text-accent">Hint {h.number}</span>
            <p className="mt-0.5 text-[13px] leading-normal text-fg-2">{h.text}</p>
          </li>
        ))}
      </ol>

      {left > 0 && (
        <button
          type="button"
          disabled
          className="cursor-not-allowed rounded-lg border border-dashed border-line-strong bg-surface-1 px-3 py-[9px] text-left text-[13px] text-muted"
        >
          Hint {used + 1} · Locked
        </button>
      )}

      {left > 0 && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted">
            {live ? "Or just ask out loud." : "Available once the interview starts."}
          </p>
          <Button size="sm" onClick={sock.requestHint} disabled={!live || sock.hintPending}>
            {sock.hintPending ? "Asking..." : "Ask for a hint"}
          </Button>
        </div>
      )}
    </div>
  );
}
