import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildInstructions } from "./prompt.js";
import { PROBLEM } from "./testHelpers.js";

const base = {
  problem: PROBLEM,
  phase: "intro" as const,
  elapsedMinutes: 0,
  hintsUsed: 0,
};

describe("buildInstructions", () => {
  it("always carries the core interviewer rules", () => {
    const text = buildInstructions(base);
    assert.match(text, /one to three short sentences/);
    assert.match(text, /Never give the solution/);
    assert.match(text, /Push back on vague answers/);
    assert.match(text, /Ask questions instead of answering/);
  });

  it("switches guidance with the phase", () => {
    assert.match(buildInstructions({ ...base, phase: "approach" }), /Current phase: approach/);
    assert.match(buildInstructions({ ...base, phase: "coding" }), /Current phase: coding/);
    assert.doesNotMatch(buildInstructions({ ...base, phase: "coding" }), /Current phase: approach/);
  });

  it("states elapsed time and how long the phase has left", () => {
    const text = buildInstructions({ ...base, phase: "coding", elapsedMinutes: 20.4 });
    assert.match(text, /about 20 minutes in/);
    assert.match(text, /done by minute 35, roughly 15 minutes/);
  });

  it("tells the interviewer to land it when time is up", () => {
    assert.match(
      buildInstructions({ ...base, phase: "wrap_up", elapsedMinutes: 46, timeUp: true }),
      /over time\. Wrap up now/,
    );
  });

  it("tracks hints used without leaking hint text", () => {
    const text = buildInstructions({ ...base, phase: "coding", hintsUsed: 1 });
    assert.match(text, /Hints: 1 of 3 used/);
    for (const hint of PROBLEM.hints) assert.ok(!text.includes(hint), `leaked: ${hint}`);
  });

  it("stops offering hints once they're all used", () => {
    assert.match(buildInstructions({ ...base, hintsUsed: 3 }), /all 3 used\. Don't call give_hint/);
  });

  it("includes the problem itself", () => {
    const text = buildInstructions(base);
    assert.match(text, /Merge Meeting Slots/);
    assert.match(text, /\[\[1,3\],\[2,6\],\[8,10\],\[15,18\]\]/);
  });
});

describe("judgment block", () => {
  it("gives the interviewer the problem's complexity, pitfalls, and probes", () => {
    const text = buildInstructions(base);
    assert.match(text, /For your judgment only\. Never say any of this out loud/);
    assert.match(text, /Best possible complexity: O\(n log n\) time, O\(n\) space/);
    for (const note of PROBLEM.interviewerNotes)
      assert.ok(text.includes(note), `missing note: ${note}`);
    for (const pitfall of PROBLEM.pitfalls)
      assert.ok(text.includes(pitfall), `missing pitfall: ${pitfall}`);
  });
});
