import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { checkDraft, ReportDraftSchema, type ReportDraft } from "./schema.js";
import { fixtureRecord, goodDraft } from "./testing/fixture.js";

const record = fixtureRecord();
const check = (draft: ReportDraft, r = record) => checkDraft(draft, r, 31 * 60);
const edit = (fn: (d: ReportDraft) => void) => {
  const d = goodDraft();
  fn(d);
  return d;
};

describe("ReportDraftSchema", () => {
  it("accepts a well-formed report", () => {
    assert.ok(ReportDraftSchema.safeParse(goodDraft()).success);
  });

  it("rejects out-of-range scores, missing categories, and unknown fields' types", () => {
    assert.ok(!ReportDraftSchema.safeParse(edit((d) => (d.overallScore = 120))).success);
    assert.ok(!ReportDraftSchema.safeParse(edit((d) => d.categories.pop())).success);
    assert.ok(
      !ReportDraftSchema.safeParse(edit((d) => ((d.moments[0] as { kind: string }).kind = "great")))
        .success,
    );
    assert.ok(!ReportDraftSchema.safeParse(edit((d) => (d.categories[0]!.score = 7.5))).success);
  });
});

describe("checkDraft", () => {
  it("passes the good report", () => {
    assert.deepEqual(check(goodDraft()), []);
  });

  it("rejects quotes the candidate never said or wrote", () => {
    const problems = check(
      edit((d) => (d.categories[0]!.evidence = ["I always clarify edge cases first."])),
    );
    assert.match(
      problems.join("\n"),
      /communication evidence "I always clarify edge cases first\." isn't something the candidate said or wrote/,
    );
  });

  it("doesn't count the interviewer's words as the candidate's", () => {
    const problems = check(
      edit((d) => (d.moments[0]!.quote = "Yes, they merge. How would you approach it?")),
    );
    assert.equal(problems.length, 1);
    assert.match(problems[0]!, /moment 1/);
  });

  it("accepts quotes that differ only in case, spacing, or quote marks, and allows ... between fragments", () => {
    assert.deepEqual(check(edit((d) => (d.moments[1]!.quote = "it’s   LINEAR i think"))), []);
    assert.deepEqual(
      check(
        edit(
          (d) => (d.moments[1]!.quote = "I'd sort by start time ... keeping the last merged slot"),
        ),
      ),
      [],
    );
  });

  it("caps a category with no evidence", () => {
    assert.match(
      check(edit((d) => (d.categories[3]!.evidence = []))).join(),
      /complexity-analysis scores 55 with no evidence/,
    );
    assert.deepEqual(
      check(
        edit((d) => {
          d.categories[3]!.evidence = [];
          d.categories[3]!.score = 40;
          d.overallScore = 62;
        }),
      ),
      [],
    );
  });

  it("caps problem-solving by hints used", () => {
    const twoHints = fixtureRecord({
      hints: [
        { number: 1, at: 100, via: "voice" },
        { number: 2, at: 200, via: "button" },
      ],
    });
    const d = edit((x) => {
      x.categories[1]!.score = 80;
      x.overallScore = 69;
    });
    assert.match(check(d, twoHints).join(), /with 2 hint\(s\) used it can be at most 75/);
  });

  it("caps problem-solving when nothing ever passed on submit", () => {
    const noPass = fixtureRecord({ runs: fixtureRecord().runs.slice(0, 1) });
    const d = edit((x) => {
      x.categories[1]!.score = 72;
      x.overallScore = 67;
    });
    assert.match(
      check(d, noPass).join(),
      /no submission ever passed every test, so it can be at most 70/,
    );
  });

  it("keeps the overall score close to the categories", () => {
    assert.match(
      check(edit((d) => (d.overallScore = 90))).join(),
      /overallScore 90 is too far from the category average 66/,
    );
  });

  it("checks that references point at real lines and versions", () => {
    const problems = check(
      edit((d) => {
        d.moments[0]!.ref = { type: "transcript", fromLine: 7, toLine: 30 };
        d.moments[2]!.ref = { type: "code", version: 9 };
        d.moments[1]!.at = 99_999;
      }),
    );
    assert.equal(problems.length, 3, problems.join("\n"));
    assert.match(problems.join("\n"), /L7-L30, but the transcript has L1-L8/);
    assert.match(problems.join("\n"), /code v9, which doesn't exist\. Versions are 1, 2/);
    assert.match(problems.join("\n"), /after the interview ended/);
  });

  it("needs each category exactly once", () => {
    assert.match(
      check(edit((d) => (d.categories[3]!.id = "communication"))).join(),
      /"communication" exactly once/,
    );
  });
});
