import type { InterviewerState } from "@/lib/voice/types";

const LABELS: Record<InterviewerState, string> = {
  idle: "Your turn",
  speaking: "Interviewer is speaking",
  thinking: "Interviewer is thinking...",
  listening: "Listening to you",
};

const BAR_HEIGHTS = [14, 22, 28, 18, 26, 12, 24, 16, 20];

// label overrides the state text before the call is live ("Connecting...", etc.)
export function InterviewerStatus({ state, label }: { state: InterviewerState; label?: string }) {
  const showBars = !label && (state === "speaking" || state === "listening");
  const showDots = !label && state === "thinking";

  return (
    <div
      role="status"
      className={`flex h-7 items-center text-[13px] text-fg-2 ${showDots ? "gap-2.5" : "gap-3"}`}
    >
      {label ?? LABELS[state]}
      {showDots && (
        <span aria-hidden="true" className="flex gap-1">
          <span className="thinking-dot h-1.5 w-1.5 rounded-full bg-muted" />
          <span className="thinking-dot h-1.5 w-1.5 rounded-full bg-muted" />
          <span className="thinking-dot h-1.5 w-1.5 rounded-full bg-muted" />
        </span>
      )}
      {showBars && (
        <span aria-hidden="true" className="flex h-7 items-center gap-[3px]">
          {BAR_HEIGHTS.map((h, i) => (
            <span
              key={i}
              className="wave-bar w-1 rounded-sm bg-accent"
              style={{ height: h, animationDelay: `${i * 0.1}s` }}
            />
          ))}
        </span>
      )}
    </div>
  );
}
