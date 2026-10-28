import { getProblem } from "@rehearse/problems";
import { createSession, type InterviewSession, type Timing } from "./session.js";

export const T0 = Date.UTC(2026, 9, 25, 17, 0, 0);
export const min = (m: number) => T0 + m * 60_000;

export const PROBLEM = getProblem("merge-meeting-slots")!;

export function newSession(timing?: Timing): InterviewSession {
  return createSession({ id: "test", problem: PROBLEM, startedAt: T0, timing });
}
