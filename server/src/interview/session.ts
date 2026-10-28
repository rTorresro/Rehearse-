import {
  INTERVIEW_PHASES,
  type CodeSnapshot,
  type InterviewPhase,
  type Problem,
} from "@rehearse/shared";

export type Phase = InterviewPhase;

export type Timing = {
  totalMinutes: number;
  // the elapsed minute each phase has to be done by. past it, time moves the interview on
  // even if the milestone never happened. wrap_up just runs until totalMinutes
  deadlines: Record<Exclude<Phase, "wrap_up">, number>;
};

// a 45 minute loop, roughly how real phone screens split up
export const DEFAULT_TIMING: Timing = {
  totalMinutes: 45,
  deadlines: { intro: 3, approach: 12, coding: 35, follow_ups: 42 },
};

// milestones the interviewer (via a tool call) or the app can report.
// each one means "we're at least at this phase now"
export const MILESTONE_TARGET = {
  problem_presented: "approach",
  approach_agreed: "coding",
  solution_complete: "follow_ups",
  follow_ups_done: "wrap_up",
  end_requested: "wrap_up",
} as const satisfies Record<string, Phase>;

export type Milestone = keyof typeof MILESTONE_TARGET;

// `at` is always passed in (ms since epoch) so the machine stays pure and testable
export type InterviewEvent =
  | { type: "tick"; at: number }
  | { type: "hint_given"; at: number }
  | { type: Milestone; at: number };

export type PhaseChange = { from: Phase; to: Phase; at: number; reason: "time" | Milestone };

export type InterviewSession = {
  id: string;
  problem: Problem;
  timing: Timing;
  startedAt: number;
  phase: Phase;
  phaseStartedAt: number;
  hintsUsed: number;
  // past totalMinutes. the phase is wrap_up by then; this tells the prompt to land it now
  timeUp: boolean;
  history: PhaseChange[];
  // the newest editor snapshot from the browser, null until they type something
  code: CodeSnapshot | null;
};

export type TransitionResult = {
  session: InterviewSession;
  phaseChanged: boolean;
  // anything the system prompt depends on changed, so the realtime session needs new instructions
  promptChanged: boolean;
};

export function createSession(opts: {
  id: string;
  problem: Problem;
  startedAt: number;
  timing?: Timing;
}): InterviewSession {
  return {
    id: opts.id,
    problem: opts.problem,
    timing: opts.timing ?? DEFAULT_TIMING,
    startedAt: opts.startedAt,
    phase: "intro",
    phaseStartedAt: opts.startedAt,
    hintsUsed: 0,
    timeUp: false,
    history: [],
    code: null,
  };
}

const rank = (p: Phase) => INTERVIEW_PHASES.indexOf(p);
const later = (a: Phase, b: Phase) => (rank(a) >= rank(b) ? a : b);

export function elapsedMinutes(session: InterviewSession, at: number) {
  return Math.max(0, at - session.startedAt) / 60_000;
}

// where the clock alone says we should be: the first phase whose deadline hasn't passed
export function phaseForTime(timing: Timing, minutes: number): Phase {
  for (const p of INTERVIEW_PHASES) {
    if (p === "wrap_up") return p;
    if (minutes < timing.deadlines[p]) return p;
  }
  return "wrap_up";
}

// the whole state machine. phases only move forward: an event or the clock can push the
// interview ahead (skipping phases if needed), nothing ever pulls it back
export function transition(session: InterviewSession, event: InterviewEvent): TransitionResult {
  const unchanged = { session, phaseChanged: false, promptChanged: false };
  const minutes = elapsedMinutes(session, event.at);

  let next = session;

  if (event.type === "hint_given") {
    if (session.hintsUsed >= session.problem.hints.length) return unchanged;
    next = { ...next, hintsUsed: session.hintsUsed + 1 };
  }

  // the clock always gets a say, whatever the event was
  let target = phaseForTime(session.timing, minutes);
  let reason: PhaseChange["reason"] = "time";
  if (event.type in MILESTONE_TARGET) {
    const milestone = event.type as Milestone;
    const fromMilestone = MILESTONE_TARGET[milestone];
    // if the milestone lands further ahead than the clock does, credit the milestone
    if (rank(fromMilestone) > rank(target)) {
      target = fromMilestone;
      reason = milestone;
    }
  }

  const phase = later(session.phase, target);
  if (phase !== session.phase) {
    next = {
      ...next,
      phase,
      phaseStartedAt: event.at,
      history: [...session.history, { from: session.phase, to: phase, at: event.at, reason }],
    };
  }

  const timeUp = minutes >= session.timing.totalMinutes;
  if (timeUp !== session.timeUp) next = { ...next, timeUp };

  if (next === session) return unchanged;
  return {
    session: next,
    phaseChanged: next.phase !== session.phase,
    promptChanged:
      next.phase !== session.phase ||
      next.hintsUsed !== session.hintsUsed ||
      next.timeUp !== session.timeUp,
  };
}

// keeps the newest snapshot. snapshots can arrive out of order on a flaky connection, so
// anything not newer than what we have is dropped
export function recordSnapshot(
  session: InterviewSession,
  snapshot: CodeSnapshot,
): { session: InterviewSession; accepted: boolean } {
  if (session.code && snapshot.version <= session.code.version) return { session, accepted: false };
  return { session: { ...session, code: snapshot }, accepted: true };
}
