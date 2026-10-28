import type { TranscriptEntry } from "@rehearse/shared";
import { formatClock } from "@/lib/format";

type Props = {
  entry: TranscriptEntry;
  // still streaming in: shows a caret, and the candidate's side gets the dashed style
  partial?: boolean;
  // replaces the timestamp, e.g. "listening" while you're still holding the mic
  label?: string;
};

export function TranscriptMessage({ entry, partial = false, label }: Props) {
  const isInterviewer = entry.role === "interviewer";
  const who = isInterviewer ? "Interviewer" : "You";

  const bubble = isInterviewer
    ? "rounded-tl bg-surface-3 text-fg"
    : partial
      ? "rounded-tr border border-dashed border-accent text-fg-2 italic"
      : "rounded-tr border border-accent bg-accent-soft text-fg";

  return (
    <li
      className={`flex max-w-[92%] flex-col gap-1 ${isInterviewer ? "items-start" : "items-end self-end"}`}
    >
      <span className="text-xs text-muted">
        {who} · {label ?? formatClock(entry.at)}
      </span>
      <p className={`rounded-xl px-3.5 py-2.5 text-sm leading-[1.55] ${bubble}`}>
        {entry.text}
        {partial && <span aria-hidden="true" className="caret" />}
      </p>
    </li>
  );
}
