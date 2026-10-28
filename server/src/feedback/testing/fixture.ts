import { getProblem } from "@rehearse/problems";
import type { RunResponse } from "@rehearse/shared";
import type { InterviewRecord } from "../record.js";
import type { ReportDraft } from "../schema.js";

export const T0 = Date.UTC(2026, 9, 27, 15, 0, 0);
const problem = getProblem("merge-meeting-slots")!;

const v1 = `def merge_slots(slots):
    slots.sort(key=lambda s: s[0])
    merged = [slots[0]]
    for start, end in slots[1:]:
        last = merged[-1]
        if start <= last[1]:
            last[1] = max(last[1], end)
        else:
            merged.append([start, end])
    return merged`;
const v2 = `def merge_slots(slots):
    if not slots:
        return []
${v1.split("\n").slice(1).join("\n")}`;

const submit = (verdict: RunResponse["verdict"], passed: number): RunResponse => ({
  mode: "submit",
  verdict,
  passed,
  total: 8,
  cases: [
    {
      index: 0,
      hidden: false,
      status: "passed",
      runtimeMs: 6,
      memoryKb: 1,
      input: "slots = [[1,3],[2,6],[8,10],[15,18]]",
      expected: "[[1,6],[8,10],[15,18]]",
      actual: "[[1,6],[8,10],[15,18]]",
    },
    {
      index: 1,
      hidden: false,
      status: "passed",
      runtimeMs: 6,
      memoryKb: 1,
      input: "slots = [[1,4],[4,5]]",
      expected: "[[1,5]]",
      actual: "[[1,5]]",
    },
    ...Array.from({ length: 6 }, (_, i) => ({
      index: i + 2,
      hidden: true,
      status: (i === 0 && verdict !== "accepted" ? "runtime_error" : "passed") as
        "runtime_error" | "passed",
      runtimeMs: 6,
      memoryKb: 1,
    })),
  ],
});

// a short but realistic interview: good approach, missed the empty case, fixed it
export function fixtureRecord(overrides: Partial<InterviewRecord> = {}): InterviewRecord {
  return {
    sessionId: "sess-1",
    problem,
    startedAt: T0,
    endedAt: T0 + 31 * 60_000,
    phases: [
      { from: "intro", to: "approach", at: T0 + 150_000, reason: "problem_presented" },
      { from: "approach", to: "coding", at: T0 + 480_000, reason: "approach_agreed" },
    ],
    transcript: [
      {
        id: "a1",
        role: "interviewer",
        at: 5,
        text: "Hi! Today we'll merge meeting slots. Any questions?",
      },
      {
        id: "u1",
        role: "candidate",
        at: 40,
        text: "Do slots that touch, like one to four and four to five, count as overlapping?",
      },
      {
        id: "a2",
        role: "interviewer",
        at: 48,
        text: "Yes, they merge. How would you approach it?",
      },
      {
        id: "u2",
        role: "candidate",
        at: 120,
        text: "I'd sort by start time, then walk through once keeping the last merged slot.",
      },
      { id: "a3", role: "interviewer", at: 130, text: "What's the complexity?" },
      { id: "u3", role: "candidate", at: 150, text: "It's linear I think, just one pass." },
      { id: "a4", role: "interviewer", at: 160, text: "What about the sort?" },
      { id: "u4", role: "candidate", at: 175, text: "Oh right, the sort makes it n log n." },
    ],
    snapshots: [
      { version: 1, timestamp: T0, at: 600, language: "python", code: v1 },
      { version: 2, timestamp: T0, at: 1500, language: "python", code: v2 },
    ],
    runs: [
      {
        at: 900,
        mode: "submit",
        language: "python",
        codeVersion: 1,
        result: submit("runtime_error", 7),
      },
      {
        at: 1560,
        mode: "submit",
        language: "python",
        codeVersion: 2,
        result: submit("accepted", 8),
      },
    ],
    hints: [],
    ...overrides,
  };
}

// a report that passes every check against fixtureRecord()
export function goodDraft(): ReportDraft {
  return {
    overallScore: 66,
    verdict: "Solid run",
    summary:
      "You found sort-then-merge quickly and explained it clearly. Complexity needed a nudge, and the empty input only surfaced when a hidden test crashed.",
    categories: [
      {
        id: "communication",
        score: 74,
        feedback:
          "You asked whether touching slots merge before writing anything, which is exactly the right instinct.",
        evidence: ["Do slots that touch, like one to four and four to five, count as overlapping?"],
      },
      {
        id: "problem-solving",
        score: 68,
        feedback:
          "You said 'I'd sort by start time, then walk through once' and that approach is correct, but the empty input crashed on submit.",
        evidence: ["I'd sort by start time, then walk through once"],
      },
      {
        id: "code-quality",
        score: 66,
        feedback:
          "Clean loop and names, but merged = [slots[0]] fails on an empty list until you added the guard.",
        evidence: ["merged = [slots[0]]", "if not slots:"],
      },
      {
        id: "complexity-analysis",
        score: 55,
        feedback: "You first said 'It's linear I think' and only caught the sort after a prompt.",
        evidence: ["It's linear I think, just one pass."],
      },
    ],
    moments: [
      {
        at: 40,
        kind: "strength",
        title: "Clarified touching slots",
        description:
          "You asked about the endpoint case before coding, which avoided a classic bug.",
        quote: "count as overlapping",
        ref: { type: "transcript", fromLine: 2, toLine: 3 },
      },
      {
        at: 150,
        kind: "needs-work",
        title: "Missed the sort in the complexity",
        description: "You called it linear and needed a nudge to account for sorting.",
        quote: "It's linear I think",
        ref: { type: "transcript", fromLine: 6, toLine: 8 },
      },
      {
        at: 900,
        kind: "needs-work",
        title: "Crashed on an empty list",
        description: "Indexing slots[0] before checking for an empty input crashed a hidden test.",
        quote: "merged = [slots[0]]",
        ref: { type: "code", version: 1 },
      },
    ],
  };
}
