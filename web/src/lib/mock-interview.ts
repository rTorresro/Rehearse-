import type { InterviewPhase } from "@rehearse/shared";

// hardcoded bits the voice loop doesn't drive yet. copy matches docs/design/interview-screen

export const PHASES: { id: InterviewPhase; label: string }[] = [
  { id: "intro", label: "Intro" },
  { id: "approach", label: "Approach" },
  { id: "coding", label: "Coding" },
  { id: "follow_ups", label: "Follow-ups" },
  { id: "wrap_up", label: "Wrap-up" },
];

export const CURRENT_PHASE: InterviewPhase = "coding";

// so the timer looks mid-interview instead of starting at zero
export const ELAPSED_SECONDS_AT_LOAD = 24 * 60 + 18;
