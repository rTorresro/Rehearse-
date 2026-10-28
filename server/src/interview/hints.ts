import type { HintsState } from "@rehearse/shared";
import type { InterviewSession } from "./session.js";

// what the candidate has unlocked so far. hints only ever unlock in order, so it's a prefix
export function hintsState(session: InterviewSession): HintsState {
  return {
    unlocked: session.problem.hints
      .slice(0, session.hintsUsed)
      .map((text, i) => ({ number: i + 1, text })),
    total: session.problem.hints.length,
  };
}
