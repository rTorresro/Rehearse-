import type { InterviewReport, ReportHistory } from "@rehearse/shared";

// same report for every id until the server generates real ones.
// copy matches docs/design/feedback-report
export function getMockReport(id: string): InterviewReport {
  return {
    id,
    problemTitle: "Merge Meeting Slots",
    difficulty: "medium",
    language: "python",
    date: "2026-10-25T17:00:00Z",
    durationSeconds: 31 * 60 + 42,
    overallScore: 78,
    verdict: "Solid run",
    summary: "Clean core solution and clear reasoning. Edge cases showed up late.",
    stats: {
      hintsUsed: 0,
      hintsTotal: 3,
      testsPassedOnSubmit: 3,
      testsTotal: 3,
      runsBeforeSubmit: 4,
    },
    categories: [
      {
        id: "communication",
        label: "Communication",
        score: 82,
        feedback:
          'You asked about touching slots before coding and narrated your plan as you typed. When a follow-up comes in, a quick "let me think" keeps the interviewer in the loop during pauses.',
        evidence: ["Do slots that touch, like [1,4] and [4,5], merge?"],
      },
      {
        id: "problem-solving",
        label: "Problem Solving",
        score: 76,
        feedback:
          "You landed on sort-then-merge without a hint. The empty input case only surfaced after a failing test, so list your edge cases out loud before you hit Run.",
        evidence: ["I'd sort by start, then keep the last merged slot"],
      },
      {
        id: "code-quality",
        label: "Code Quality",
        score: 71,
        feedback:
          "Readable names and a tidy loop. Put the empty check at the top from the start, and leave a short comment on why you mutate the last merged slot in place.",
        evidence: ["merged = [slots[0]]"],
      },
      {
        id: "complexity-analysis",
        label: "Complexity Analysis",
        score: 84,
        feedback:
          "You gave O(n log n) time right away and tied it to the sort. For space, mention that the sort is in place so the only extra memory is the output list.",
        evidence: ["O(n log n) because of the sort, then one linear pass"],
      },
    ],
    moments: [
      {
        id: "m1",
        at: 3 * 60 + 12,
        kind: "strength",
        title: "Clarified touching slots",
        description: "You asked whether [1,4] and [4,5] should merge before writing anything.",
        quote: "should they merge?",
        ref: { type: "transcript", fromLine: 3, toLine: 4 },
      },
      {
        id: "m2",
        at: 7 * 60 + 40,
        kind: "strength",
        title: "Explained the approach first",
        description:
          "Sort by start, then one pass keeping the last merged slot. You said this out loud before typing.",
        quote: "Sort by start, then one pass",
        ref: { type: "transcript", fromLine: 7, toLine: 9 },
      },
      {
        id: "m3",
        at: 24 * 60 + 9,
        kind: "strength",
        title: "Stated time complexity clearly",
        description:
          "O(n log n) from the sort plus one linear pass, with the reason for each part.",
        quote: "O(n log n) from the sort",
        ref: { type: "transcript", fromLine: 14, toLine: 16 },
      },
      {
        id: "m4",
        at: 24 * 60 + 40,
        kind: "needs-work",
        title: "Missed the empty input case",
        description:
          "Case 3 failed with an IndexError on []. The interviewer had to point you to the output before you found line 4.",
        quote: "merged = [slots[0]]",
        ref: { type: "code", version: 3 },
      },
      {
        id: "m5",
        at: 27 * 60 + 30,
        kind: "strength",
        title: "Fixed it cleanly",
        description: "You returned an empty list up front, reran, and all three cases passed.",
        quote: "if not slots: return []",
        ref: { type: "code", version: 4 },
      },
    ],
  };
}

// what the sample report's moments point at, so its buttons work on /report/demo
export function getMockHistory(): ReportHistory {
  return {
    transcript: [
      {
        line: 1,
        at: 5,
        role: "interviewer",
        text: "Hi! Today's problem is merging meeting slots. Take a second to read it, and ask me anything.",
      },
      {
        line: 2,
        at: 150,
        role: "interviewer",
        text: "Any questions before you start?",
      },
      {
        line: 3,
        at: 192,
        role: "candidate",
        text: "Quick question: if two slots just touch, like [1,4] and [4,5], should they merge?",
      },
      {
        line: 4,
        at: 200,
        role: "interviewer",
        text: "Good question. They merge.",
      },
      {
        line: 5,
        at: 300,
        role: "interviewer",
        text: "How would you approach it?",
      },
      {
        line: 6,
        at: 380,
        role: "candidate",
        text: "Brute force would compare every pair, so that's quadratic.",
      },
      {
        line: 7,
        at: 460,
        role: "candidate",
        text: "Sort by start, then one pass keeping the last merged slot. If the next one starts before the last one ends, extend it.",
      },
      {
        line: 8,
        at: 470,
        role: "interviewer",
        text: "Sounds good. Why does sorting make one pass enough?",
      },
      {
        line: 9,
        at: 480,
        role: "candidate",
        text: "After sorting, anything that overlaps the last merged slot has to come right after it.",
      },
      {
        line: 10,
        at: 490,
        role: "interviewer",
        text: "Great, go ahead and code it.",
      },
      {
        line: 11,
        at: 1380,
        role: "interviewer",
        text: "Nice, sorting by start time is a solid first move. What's the time complexity so far?",
      },
      {
        line: 12,
        at: 1400,
        role: "candidate",
        text: "Let me think... it's the sort plus the loop.",
      },
      {
        line: 13,
        at: 1430,
        role: "interviewer",
        text: "And together?",
      },
      {
        line: 14,
        at: 1449,
        role: "candidate",
        text: "It's O(n log n) from the sort, then one linear pass to merge.",
      },
      {
        line: 15,
        at: 1455,
        role: "interviewer",
        text: "Good. And space?",
      },
      {
        line: 16,
        at: 1462,
        role: "candidate",
        text: "O(n) for the output list.",
      },
      {
        line: 17,
        at: 1475,
        role: "interviewer",
        text: "Run the third test case and tell me what you see in the output.",
      },
      {
        line: 18,
        at: 1480,
        role: "candidate",
        text: "It crashes with an index error on the empty list. I'll add a guard at the top.",
      },
      {
        line: 19,
        at: 1650,
        role: "candidate",
        text: "Okay, I return an empty list up front now, and all three pass.",
      },
      {
        line: 20,
        at: 1660,
        role: "interviewer",
        text: "Nice fix.",
      },
    ],
    snapshots: [
      {
        version: 1,
        at: 520,
        language: "python",
        code: "def merge_slots(slots):\n    slots.sort(key=lambda s: s[0])\n    merged = []\n    return merged",
      },
      {
        version: 2,
        at: 700,
        language: "python",
        code: "def merge_slots(slots):\n    slots.sort(key=lambda s: s[0])\n    merged = []\n    for start, end in slots:\n        merged.append([start, end])\n    return merged",
      },
      {
        version: 3,
        at: 1150,
        language: "python",
        code: "def merge_slots(slots):\n    # sort by start so overlaps sit side by side\n    slots.sort(key=lambda s: s[0])\n    merged = [slots[0]]\n\n    for start, end in slots[1:]:\n        last = merged[-1]\n        if start <= last[1]:\n            last[1] = max(last[1], end)\n        else:\n            merged.append([start, end])\n\n    return merged",
      },
      {
        version: 4,
        at: 1640,
        language: "python",
        code: "def merge_slots(slots):\n    # sort by start so overlaps sit side by side\n    if not slots:\n        return []\n    slots.sort(key=lambda s: s[0])\n    merged = [slots[0]]\n\n    for start, end in slots[1:]:\n        last = merged[-1]\n        if start <= last[1]:\n            last[1] = max(last[1], end)\n        else:\n            merged.append([start, end])\n\n    return merged",
      },
    ],
  };
}
