import {
  MILESTONE_TARGET,
  transition,
  type InterviewSession,
  type Milestone,
  type TransitionResult,
} from "./session.js";

// the end_requested milestone comes from the app (End interview), not from the model
const MODEL_MILESTONES = Object.keys(MILESTONE_TARGET).filter((m) => m !== "end_requested");

// handed to the realtime session. the model reports progress and asks for hints through
// these, which is how the server stays the source of truth for phase and hint count
export const INTERVIEW_TOOLS = [
  {
    type: "function",
    name: "give_hint",
    description:
      "Get the next hint for the problem. Only call this when the candidate is clearly stuck or asks for a hint. Then deliver it in your own words as a small nudge, never as the answer.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    type: "function",
    name: "signal_progress",
    description:
      "Report that the interview reached a milestone, so it can move to the next phase. Call it once, when the milestone is clearly met.",
    parameters: {
      type: "object",
      properties: {
        milestone: {
          type: "string",
          enum: MODEL_MILESTONES,
          description:
            "problem_presented: problem explained and clarifying questions done. approach_agreed: a concrete, working approach is agreed. solution_complete: the code is done and checked. follow_ups_done: complexity, edge cases, and a variation are covered.",
        },
      },
      required: ["milestone"],
      additionalProperties: false,
    },
  },
] as const;

export type ToolCallResult = TransitionResult & {
  // JSON string sent back to the model as the function_call_output
  output: string;
};

// pure: a tool call from the model becomes a state machine event plus the reply the model sees
export function handleToolCall(
  session: InterviewSession,
  name: string,
  rawArgs: string,
  at: number,
): ToolCallResult {
  if (name === "give_hint") {
    const result = transition(session, { type: "hint_given", at });
    if (result.session.hintsUsed === session.hintsUsed) {
      return {
        ...result,
        output: JSON.stringify({ error: "No hints left. Use a guiding question instead." }),
      };
    }
    const n = result.session.hintsUsed;
    return {
      ...result,
      output: JSON.stringify({
        hint: session.problem.hints[n - 1],
        hint_number: n,
        hints_left: session.problem.hints.length - n,
        how_to_deliver:
          "Say it in your own words as a short nudge or question. Never read this text word for word.",
      }),
    };
  }

  if (name === "signal_progress") {
    let milestone: unknown;
    try {
      milestone = (JSON.parse(rawArgs) as { milestone?: unknown }).milestone;
    } catch {
      // fall through to the error below
    }
    if (typeof milestone !== "string" || !MODEL_MILESTONES.includes(milestone)) {
      return {
        session,
        phaseChanged: false,
        promptChanged: false,
        output: JSON.stringify({
          error: `Unknown milestone. Use one of: ${MODEL_MILESTONES.join(", ")}`,
        }),
      };
    }
    const result = transition(session, { type: milestone as Milestone, at });
    return { ...result, output: JSON.stringify({ ok: true, phase: result.session.phase }) };
  }

  return {
    session,
    phaseChanged: false,
    promptChanged: false,
    output: JSON.stringify({ error: `Unknown tool ${name}` }),
  };
}
