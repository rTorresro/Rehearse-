import type { PointerEvent } from "react";
import { MicIcon } from "@/components/ui/icons";
import type { InterviewerState } from "@/lib/voice/types";

type Props = { state: InterviewerState; disabled: boolean; onHold: (holding: boolean) => void };

const LABELS: Record<InterviewerState, string> = {
  idle: "Hold to talk",
  thinking: "Hold to talk",
  speaking: "Hold to interrupt",
  listening: "Talking. Release to send",
};

// push-to-talk: press and hold. Space works anywhere via useSpaceToTalk
export function MicButton({ state, disabled, onHold }: Props) {
  const active = state === "listening";

  function press(e: PointerEvent<HTMLButtonElement>) {
    // keep getting the release even if the pointer drifts off the button mid-sentence
    e.currentTarget.setPointerCapture(e.pointerId);
    onHold(true);
  }

  return (
    <button
      type="button"
      data-talk
      disabled={disabled}
      aria-label={LABELS[state]}
      onPointerDown={press}
      onPointerUp={() => onHold(false)}
      onPointerCancel={() => onHold(false)}
      // long-press on touch would otherwise pop the context menu
      onContextMenu={(e) => e.preventDefault()}
      className={`flex h-[68px] w-[68px] touch-none items-center justify-center rounded-full transition-colors select-none disabled:cursor-not-allowed disabled:opacity-50 ${
        active
          ? "bg-accent text-on-accent shadow-[0_0_0_6px_var(--color-accent-soft)]"
          : "border-[1.5px] border-accent bg-surface-3 text-accent"
      }`}
    >
      <MicIcon className="h-[26px] w-[26px]" />
    </button>
  );
}
