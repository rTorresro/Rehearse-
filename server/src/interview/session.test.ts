import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_TIMING,
  phaseForTime,
  recordSnapshot,
  transition,
  type InterviewEvent,
  type InterviewSession,
} from "./session.js";
import { min, newSession } from "./testHelpers.js";

// runs a list of events through the machine, returning the final session
function run(events: InterviewEvent[], start = newSession()) {
  return events.reduce((s, e) => transition(s, e).session, start);
}

describe("createSession", () => {
  it("starts in intro with no hints used", () => {
    const s = newSession();
    assert.equal(s.phase, "intro");
    assert.equal(s.hintsUsed, 0);
    assert.equal(s.timeUp, false);
    assert.deepEqual(s.history, []);
  });
});

describe("milestone events", () => {
  it("walks through every phase in order", () => {
    let s = newSession();
    const seen = [s.phase];
    for (const [type, at] of [
      ["problem_presented", 2],
      ["approach_agreed", 8],
      ["solution_complete", 25],
      ["follow_ups_done", 33],
    ] as const) {
      s = transition(s, { type, at: min(at) }).session;
      seen.push(s.phase);
    }
    assert.deepEqual(seen, ["intro", "approach", "coding", "follow_ups", "wrap_up"]);
  });

  it("records why and when each phase changed", () => {
    const s = run([{ type: "problem_presented", at: min(2) }]);
    assert.deepEqual(s.history, [
      { from: "intro", to: "approach", at: min(2), reason: "problem_presented" },
    ]);
    assert.equal(s.phaseStartedAt, min(2));
  });

  it("can skip ahead when a later milestone comes early", () => {
    const s = run([{ type: "approach_agreed", at: min(1) }]);
    assert.equal(s.phase, "coding");
    assert.equal(s.history.length, 1);
    assert.equal(s.history[0]?.from, "intro");
  });

  it("ignores milestones for phases already passed", () => {
    const coding = run([{ type: "approach_agreed", at: min(5) }]);
    const result = transition(coding, { type: "problem_presented", at: min(6) });
    assert.equal(result.session, coding);
    assert.equal(result.phaseChanged, false);
    assert.equal(result.promptChanged, false);
  });

  it("ignores a repeated milestone", () => {
    const approach = run([{ type: "problem_presented", at: min(1) }]);
    const result = transition(approach, { type: "problem_presented", at: min(2) });
    assert.equal(result.phaseChanged, false);
    assert.equal(result.session.history.length, 1);
  });

  it("end_requested jumps to wrap_up from any phase", () => {
    for (const setup of [[], [{ type: "approach_agreed", at: min(4) }]] as InterviewEvent[][]) {
      const s = run([...setup, { type: "end_requested", at: min(5) }]);
      assert.equal(s.phase, "wrap_up");
      assert.equal(s.history.at(-1)?.reason, "end_requested");
    }
  });

  it("wrap_up is final", () => {
    const done = run([{ type: "end_requested", at: min(5) }]);
    for (const type of ["problem_presented", "approach_agreed", "follow_ups_done"] as const) {
      assert.equal(transition(done, { type, at: min(6) }).phaseChanged, false);
    }
  });
});

describe("time", () => {
  it("doesn't move before a deadline", () => {
    const result = transition(newSession(), { type: "tick", at: min(2.9) });
    assert.equal(result.phaseChanged, false);
    assert.equal(result.promptChanged, false);
  });

  it("moves on at the deadline even without the milestone", () => {
    const result = transition(newSession(), {
      type: "tick",
      at: min(DEFAULT_TIMING.deadlines.intro),
    });
    assert.equal(result.session.phase, "approach");
    assert.equal(result.phaseChanged, true);
    assert.equal(result.promptChanged, true);
    assert.equal(result.session.history[0]?.reason, "time");
  });

  it("jumps straight to where the clock says after a long gap, in one step", () => {
    const s = run([{ type: "tick", at: min(38) }]);
    assert.equal(s.phase, "follow_ups");
    assert.deepEqual(s.history, [{ from: "intro", to: "follow_ups", at: min(38), reason: "time" }]);
  });

  it("never moves backward when a milestone got ahead of the clock", () => {
    const coding = run([{ type: "approach_agreed", at: min(4) }]);
    const result = transition(coding, { type: "tick", at: min(6) });
    assert.equal(result.session.phase, "coding");
    assert.equal(result.phaseChanged, false);
  });

  it("credits the clock when it's further ahead than a late milestone", () => {
    // approach_agreed arrives after the coding deadline: the clock wins
    const s = run([{ type: "approach_agreed", at: min(36) }]);
    assert.equal(s.phase, "follow_ups");
    assert.equal(s.history.at(-1)?.reason, "time");
  });

  it("flags time up at the total, once", () => {
    const first = transition(newSession(), { type: "tick", at: min(DEFAULT_TIMING.totalMinutes) });
    assert.equal(first.session.phase, "wrap_up");
    assert.equal(first.session.timeUp, true);
    assert.equal(first.promptChanged, true);

    const again = transition(first.session, {
      type: "tick",
      at: min(DEFAULT_TIMING.totalMinutes + 1),
    });
    assert.equal(again.promptChanged, false);
    assert.equal(again.session, first.session);
  });

  it("treats events stamped before the start as minute zero", () => {
    const result = transition(newSession(), { type: "tick", at: min(-5) });
    assert.equal(result.session.phase, "intro");
    assert.equal(result.phaseChanged, false);
  });

  it("respects custom timing", () => {
    const fast = {
      totalMinutes: 10,
      deadlines: { intro: 1, approach: 3, coding: 7, follow_ups: 9 },
    };
    assert.equal(run([{ type: "tick", at: min(5) }], newSession(fast)).phase, "coding");
    assert.equal(run([{ type: "tick", at: min(9.5) }], newSession(fast)).phase, "wrap_up");
  });

  it("phaseForTime maps each window to its phase", () => {
    const d = DEFAULT_TIMING.deadlines;
    assert.equal(phaseForTime(DEFAULT_TIMING, 0), "intro");
    assert.equal(phaseForTime(DEFAULT_TIMING, d.intro), "approach");
    assert.equal(phaseForTime(DEFAULT_TIMING, d.approach - 0.01), "approach");
    assert.equal(phaseForTime(DEFAULT_TIMING, d.approach), "coding");
    assert.equal(phaseForTime(DEFAULT_TIMING, d.coding), "follow_ups");
    assert.equal(phaseForTime(DEFAULT_TIMING, d.follow_ups), "wrap_up");
    assert.equal(phaseForTime(DEFAULT_TIMING, 999), "wrap_up");
  });
});

describe("hints", () => {
  it("counts a hint without changing phase, and asks for a prompt update", () => {
    const result = transition(newSession(), { type: "hint_given", at: min(1) });
    assert.equal(result.session.hintsUsed, 1);
    assert.equal(result.phaseChanged, false);
    assert.equal(result.promptChanged, true);
  });

  it("caps at the number of hints the problem has", () => {
    const total = newSession().problem.hints.length;
    let s: InterviewSession = newSession();
    for (let i = 0; i < total; i++) s = transition(s, { type: "hint_given", at: min(1) }).session;
    assert.equal(s.hintsUsed, total);

    const extra = transition(s, { type: "hint_given", at: min(2) });
    assert.equal(extra.session.hintsUsed, total);
    assert.equal(extra.promptChanged, false);
  });

  it("still lets the clock move the phase on a hint event", () => {
    const result = transition(newSession(), { type: "hint_given", at: min(13) });
    assert.equal(result.session.hintsUsed, 1);
    assert.equal(result.session.phase, "coding");
  });
});

describe("purity", () => {
  it("never mutates the session it's given", () => {
    const s = newSession();
    const snapshot = structuredClone(s);
    transition(s, { type: "approach_agreed", at: min(4) });
    transition(s, { type: "hint_given", at: min(4) });
    transition(s, { type: "tick", at: min(50) });
    assert.deepEqual(s, snapshot);
  });

  it("returns the same object when nothing changed", () => {
    const s = newSession();
    assert.equal(transition(s, { type: "tick", at: min(1) }).session, s);
  });
});

describe("code snapshots", () => {
  const snap = (version: number, code = `v${version}`) => ({
    version,
    timestamp: min(1),
    language: "python" as const,
    code,
  });

  it("starts with no code", () => {
    assert.equal(newSession().code, null);
  });

  it("keeps the newest snapshot and drops older or repeated versions", () => {
    let s = recordSnapshot(newSession(), snap(2)).session;
    assert.equal(s.code?.version, 2);

    const stale = recordSnapshot(s, snap(1));
    assert.equal(stale.accepted, false);
    assert.equal(stale.session, s);

    const repeat = recordSnapshot(s, snap(2, "different"));
    assert.equal(repeat.accepted, false);

    s = recordSnapshot(s, snap(5)).session;
    assert.equal(s.code?.code, "v5");
  });
});
