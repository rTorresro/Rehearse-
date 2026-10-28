"use client";

import { useEffect, useRef } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { formatClock } from "@/lib/format";
import { HistoryStatus } from "./HistoryStatus";
import type { HistoryState, ViewTarget } from "./ReportViewerProvider";

type Props = {
  target: (ViewTarget & { type: "transcript" }) | null;
  history: HistoryState;
  onRetry: () => void;
  onClose: () => void;
};

export function TranscriptDrawer({ target, history, onRetry, onClose }: Props) {
  const listRef = useRef<HTMLOListElement>(null);
  const lines = history.status === "ready" ? history.history.transcript : [];

  // what to highlight: the cited range, or for a moment pinned to a time, the last line
  // said at or before it
  let from = target?.fromLine;
  let to = target?.toLine;
  if (target && from === undefined && target.at !== undefined && lines.length) {
    const before = lines.filter((l) => l.at <= target.at!);
    from = to = (before.at(-1) ?? lines[0]!).line;
  }
  const highlighted = (n: number) => from !== undefined && to !== undefined && n >= from && n <= to;

  // once the lines are there, bring the highlighted ones into view
  useEffect(() => {
    if (!target || from === undefined || !lines.length) return;
    const el = listRef.current?.querySelector<HTMLElement>(`[data-line="${from}"]`);
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
  }, [target, from, lines.length]);

  const subtitle =
    from === undefined
      ? `${lines.length} lines`
      : from === to
        ? `Line ${from}`
        : `Lines ${from}-${to}`;

  return (
    <Dialog
      variant="drawer"
      open={target !== null}
      onClose={onClose}
      title="Transcript"
      subtitle={history.status === "ready" ? subtitle : undefined}
    >
      {history.status !== "ready" ? (
        <HistoryStatus state={history} onRetry={onRetry} />
      ) : lines.length === 0 ? (
        <p className="p-6 text-[13px] text-muted">Nothing was said in this interview.</p>
      ) : (
        <ol ref={listRef} className="h-full overflow-y-auto py-3">
          {lines.map((l) => {
            const on = highlighted(l.line);
            return (
              <li
                key={l.line}
                data-line={l.line}
                aria-current={on ? "true" : undefined}
                className={`grid grid-cols-[40px_44px_1fr] gap-x-3 border-l-2 px-5 py-2 text-[13.5px] leading-[1.55] ${
                  on ? "border-accent bg-accent-soft" : "border-transparent"
                }`}
              >
                <span className="pt-px font-mono text-xs text-code-number">L{l.line}</span>
                <span className="pt-px font-mono text-xs text-muted">{formatClock(l.at)}</span>
                <span>
                  <span
                    className={`mr-1.5 text-xs font-medium ${l.role === "candidate" ? "text-accent" : "text-muted"}`}
                  >
                    {l.role === "candidate" ? "You" : "Interviewer"}
                  </span>
                  <span className={l.role === "candidate" ? "text-fg" : "text-fg-2"}>{l.text}</span>
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </Dialog>
  );
}
