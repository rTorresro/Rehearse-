import type { InterviewerState } from "@/lib/voice/types";

// purely visual; InterviewerStatus says the state in words.
// animations live in globals.css so reduced-motion can kill them in one spot
export function VoiceOrb({ state }: { state: InterviewerState }) {
  return (
    <div aria-hidden="true" data-state={state} className="orb relative h-[190px] w-[190px]">
      <span className="orb-ring absolute inset-0 rounded-full border-[1.5px] border-accent" />
      <span className="orb-ring absolute inset-0 rounded-full border-[1.5px] border-accent" />
      <span className="orb-core absolute inset-[34px] rounded-full" />
    </div>
  );
}
