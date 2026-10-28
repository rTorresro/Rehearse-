import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { handleToolCall } from "./tools.js";
import { min, newSession } from "./testHelpers.js";

describe("give_hint", () => {
  it("returns hints in order and counts them", () => {
    const s0 = newSession();
    const first = handleToolCall(s0, "give_hint", "{}", min(5));
    assert.deepEqual(JSON.parse(first.output), {
      hint: s0.problem.hints[0],
      hint_number: 1,
      hints_left: s0.problem.hints.length - 1,
      how_to_deliver:
        "Say it in your own words as a short nudge or question. Never read this text word for word.",
    });
    const second = handleToolCall(first.session, "give_hint", "{}", min(6));
    assert.equal(JSON.parse(second.output).hint, s0.problem.hints[1]);
    assert.equal(second.session.hintsUsed, 2);
  });

  it("says no once hints run out", () => {
    let s = newSession();
    const total = s.problem.hints.length;
    for (let i = 0; i < total; i++) s = handleToolCall(s, "give_hint", "{}", min(5)).session;
    const out = handleToolCall(s, "give_hint", "{}", min(6));
    assert.match(JSON.parse(out.output).error, /No hints left/);
    assert.equal(out.promptChanged, false);
  });
});

describe("signal_progress", () => {
  it("advances the phase", () => {
    const out = handleToolCall(
      newSession(),
      "signal_progress",
      '{"milestone":"problem_presented"}',
      min(2),
    );
    assert.equal(out.session.phase, "approach");
    assert.equal(out.phaseChanged, true);
    assert.deepEqual(JSON.parse(out.output), { ok: true, phase: "approach" });
  });

  it("won't let the model end the interview", () => {
    const out = handleToolCall(
      newSession(),
      "signal_progress",
      '{"milestone":"end_requested"}',
      min(2),
    );
    assert.equal(out.session.phase, "intro");
    assert.match(JSON.parse(out.output).error, /Unknown milestone/);
  });

  it("survives junk arguments", () => {
    for (const args of ["not json", "{}", '{"milestone":42}']) {
      const out = handleToolCall(newSession(), "signal_progress", args, min(2));
      assert.equal(out.phaseChanged, false);
      assert.ok(JSON.parse(out.output).error);
    }
  });
});

it("rejects unknown tools", () => {
  const out = handleToolCall(newSession(), "delete_everything", "{}", min(1));
  assert.match(JSON.parse(out.output).error, /Unknown tool/);
});
