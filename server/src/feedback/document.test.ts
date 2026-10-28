import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildFeedbackDocument } from "./document.js";
import { fixtureRecord } from "./testing/fixture.js";

describe("buildFeedbackDocument", () => {
  const doc = buildFeedbackDocument(
    fixtureRecord({ hints: [{ number: 1, at: 700, via: "button" }] }),
  );

  it("numbers the transcript with times, so moments can point at lines", () => {
    assert.match(doc.text, /\[L1 00:05\] Interviewer: Hi! Today we'll merge meeting slots/);
    assert.match(doc.text, /\[L6 02:30\] Candidate: It's linear I think, just one pass\./);
    assert.equal(doc.transcriptLines.length, 8);
    assert.equal(doc.durationSeconds, 31 * 60);
  });

  it("includes the first version whole, then the changes, then the final version whole", () => {
    assert.match(
      doc.text,
      /### v1 at 10:00 \(python\), full file:\n 1\| def merge_slots\(slots\):/,
    );
    assert.match(doc.text, /### v2 at 25:00 \(python\), changes from v1:/);
    assert.ok(doc.text.includes("+   2|     if not slots:"));
    assert.match(doc.text, /Final version, full file:\n 1\| def merge_slots/);
  });

  it("includes runs, hints, the problem's best complexity, and what to probe", () => {
    assert.match(doc.text, /### 1\. at 15:00 on code v1\nTest run \(Submit/);
    assert.match(doc.text, /Hint 1 at 11:40, asked with the hint button: /);
    assert.match(doc.text, /Best possible complexity: O\(n log n\) time, O\(n\) space\./);
    assert.match(doc.text, /What a strong answer shows:\n- Ask why sorting by start/);
  });

  it("never includes hidden test inputs or the live-interview note", () => {
    const hidden = fixtureRecord().problem.testCases.filter((t) => t.hidden);
    // inputs as short as "[]" also turn up in ordinary code, so check the distinctive ones
    const distinctive = hidden.map((t) => JSON.stringify(t.args[0])).filter((x) => x.length > 6);
    assert.ok(distinctive.length >= 3);
    for (const x of distinctive) assert.ok(!doc.text.includes(x), `leaked ${x}`);
    assert.ok(!doc.text.includes("never read them out"));
  });
});
