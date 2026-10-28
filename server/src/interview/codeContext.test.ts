import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { CodeSnapshot } from "@rehearse/shared";
import {
  codeContextMessage,
  diffLines,
  FULL_RESEND_EVERY,
  SHORT_FILE_LINES,
  type ForwardedCode,
} from "./codeContext.js";

const snap = (
  version: number,
  code: string,
  language: CodeSnapshot["language"] = "python",
): CodeSnapshot => ({
  version,
  timestamp: 0,
  language,
  code,
});

// a file comfortably past the "short" cutoff
const longFile = (edit?: (lines: string[]) => void) => {
  const lines = Array.from({ length: SHORT_FILE_LINES + 20 }, (_, i) => `    x${i} = ${i}`);
  edit?.(lines);
  return lines.join("\n");
};

const forwardedFrom = (s: CodeSnapshot, diffsSinceFull = 0): ForwardedCode => ({
  version: s.version,
  language: s.language,
  code: s.code,
  diffsSinceFull,
});

describe("codeContextMessage", () => {
  it("sends a short file whole, with line numbers", () => {
    const msg = codeContextMessage(null, snap(1, "def f(xs):\n    return xs"), 3.7);
    assert.equal(msg?.kind, "full");
    assert.match(msg!.text, /^Code snapshot v1 \(python, 2 lines, about 3 min in\)/);
    assert.ok(msg!.text.endsWith("1| def f(xs):\n2|     return xs"));
  });

  it("keeps sending short files whole, even after earlier snapshots", () => {
    const first = snap(1, "a = 1");
    const msg = codeContextMessage(forwardedFrom(first), snap(2, "a = 2"), 5);
    assert.equal(msg?.kind, "full");
  });

  it("returns nothing when the code hasn't changed", () => {
    const s = snap(1, "a = 1");
    assert.equal(codeContextMessage(forwardedFrom(s), snap(2, "a = 1"), 5), null);
  });

  it("sends the first snapshot of a long file whole", () => {
    assert.equal(codeContextMessage(null, snap(1, longFile()), 5)?.kind, "full");
  });

  it("sends a small edit to a long file as a diff with new-file line numbers", () => {
    const before = snap(1, longFile());
    const after = snap(
      2,
      longFile((l) => {
        l[9] = "    x9 = 999";
        l.splice(30, 0, "    print('debug')");
      }),
    );
    const msg = codeContextMessage(forwardedFrom(before), after, 12);
    assert.equal(msg?.kind, "diff");
    const t = msg!.text;
    assert.match(
      t,
      /^Code update v2 \(python, 81 lines now, about 12 min in\)\. Only what changed since v1/,
    );
    assert.match(t, /@@ lines 9-11 \(1 added, 1 removed\)/);
    // the removed line comes first, then its replacement, like a normal diff
    assert.ok(t.includes("-  |     x9 = 9\n+10|     x9 = 999"), t);
    assert.ok(t.includes("+31|     print('debug')"), t);
    assert.match(t, /In total: 2 lines added, 1 removed\.$/);
    // far shorter than the file itself
    assert.ok(t.length < after.code.length / 2);
    assert.equal(msg!.forwarded.diffsSinceFull, 1);
  });

  it("re-sends a long file whole every so often", () => {
    const before = snap(1, longFile());
    const after = snap(
      2,
      longFile((l) => (l[0] = "# changed")),
    );
    const due = codeContextMessage(forwardedFrom(before, FULL_RESEND_EVERY - 1), after, 1);
    assert.equal(due?.kind, "full");
    assert.equal(due?.forwarded.diffsSinceFull, 0);
  });

  it("sends the whole file when the language changes", () => {
    const before = snap(1, longFile());
    assert.equal(
      codeContextMessage(forwardedFrom(before), snap(2, longFile(), "java"), 1)?.kind,
      "full",
    );
  });

  it("sends the whole file when the change is too big to summarize", () => {
    const before = snap(1, longFile());
    const rewritten = snap(
      2,
      longFile((l) => l.forEach((_, i) => (l[i] = `    y${i} = ${i}`))),
    );
    assert.equal(codeContextMessage(forwardedFrom(before), rewritten, 1)?.kind, "full");
  });
});

describe("diffLines", () => {
  it("marks adds, deletes, and unchanged lines in order", () => {
    const ops = diffLines(["a", "b", "c"], ["a", "x", "c", "d"])!;
    assert.deepEqual(
      ops.map((o) => `${o.kind}:${o.text}:${o.newLine ?? "-"}`),
      ["same:a:1", "del:b:-", "add:x:2", "same:c:3", "add:d:4"],
    );
  });

  it("handles empty sides", () => {
    assert.deepEqual(
      diffLines([], ["a"])!.map((o) => o.kind),
      ["add"],
    );
    assert.deepEqual(
      diffLines(["a"], [])!.map((o) => o.kind),
      ["del"],
    );
  });
});
