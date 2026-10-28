import type { CodeSnapshot } from "@rehearse/shared";

// how the candidate's code reaches the interviewer. each update becomes a system message in
// the realtime conversation, and those pile up in the model's context, so long files go as
// diff summaries instead of being re-sent whole every time

// at or under both of these, just send the whole file every time; it's cheap and clearest
export const SHORT_FILE_LINES = 60;
export const SHORT_FILE_CHARS = 3_000;
// a long file gets re-sent whole after this many diffs, so the model never drifts far
// from a known full copy
export const FULL_RESEND_EVERY = 8;
// a diff showing more lines than this isn't a summary anymore; send the file instead
export const MAX_DIFF_LINES = 40;
// unchanged lines shown around each change, so the model can place it
const CONTEXT_LINES = 1;
// past this many line comparisons, skip the diff and send the whole file
const MAX_DIFF_WORK = 2_000_000;

// what the model last saw, so the next update can be described relative to it
export type ForwardedCode = {
  version: number;
  language: CodeSnapshot["language"];
  code: string;
  diffsSinceFull: number;
};

export type CodeMessage = { kind: "full" | "diff"; text: string; forwarded: ForwardedCode };

const numbered = (n: number, width: number) => String(n).padStart(width);

function fullMessage(snap: CodeSnapshot, minutesIn: number): string {
  const lines = snap.code.split("\n");
  const width = String(lines.length).length;
  const body = lines.map((l, i) => `${numbered(i + 1, width)}| ${l}`).join("\n");
  return `Code snapshot v${snap.version} (${snap.language}, ${lines.length} lines, about ${Math.floor(minutesIn)} min in). This is the candidate's whole file right now and replaces any earlier snapshot:
${body}`;
}

type Op = { kind: "same" | "add" | "del"; text: string; newLine?: number };

// line diff: trim the common start and end, then LCS on what's left.
// null if the middle is too big to diff cheaply
export function diffLines(before: string[], after: string[]): Op[] | null {
  let start = 0;
  while (start < before.length && start < after.length && before[start] === after[start]) start++;
  let endB = before.length;
  let endA = after.length;
  while (endB > start && endA > start && before[endB - 1] === after[endA - 1]) {
    endB--;
    endA--;
  }
  const midB = before.slice(start, endB);
  const midA = after.slice(start, endA);
  if (midB.length * midA.length > MAX_DIFF_WORK) return null;

  // lcs[i][j] = longest common run of midB[i..] and midA[j..]
  const lcs = Array.from({ length: midB.length + 1 }, () => new Uint32Array(midA.length + 1));
  for (let i = midB.length - 1; i >= 0; i--) {
    for (let j = midA.length - 1; j >= 0; j--) {
      lcs[i]![j] =
        midB[i] === midA[j] ? lcs[i + 1]![j + 1]! + 1 : Math.max(lcs[i + 1]![j]!, lcs[i]![j + 1]!);
    }
  }

  const ops: Op[] = [];
  for (let k = 0; k < start; k++) ops.push({ kind: "same", text: after[k]!, newLine: k + 1 });
  let i = 0;
  let j = 0;
  while (i < midB.length || j < midA.length) {
    if (i < midB.length && j < midA.length && midB[i] === midA[j]) {
      ops.push({ kind: "same", text: midA[j]!, newLine: start + j + 1 });
      i++;
      j++;
    } else if (j < midA.length && (i >= midB.length || lcs[i]![j + 1]! > lcs[i + 1]![j]!)) {
      // strict >, so on a tie the removal comes first: "- old" then "+ new", like a normal diff
      ops.push({ kind: "add", text: midA[j]!, newLine: start + j + 1 });
      j++;
    } else {
      ops.push({ kind: "del", text: midB[i]! });
      i++;
    }
  }
  for (let k = endA; k < after.length; k++)
    ops.push({ kind: "same", text: after[k]!, newLine: k + 1 });
  return ops;
}

// groups changes into hunks with a line of context either side, and renders them with
// new-file line numbers so the interviewer can say "on line 14"
function diffMessage(
  prev: ForwardedCode,
  snap: CodeSnapshot,
  ops: Op[],
  minutesIn: number,
): string | null {
  const changed = ops.flatMap((op, i) => (op.kind === "same" ? [] : [i]));
  if (changed.length === 0) return null;

  const hunks: [number, number][] = [];
  for (const i of changed) {
    const from = Math.max(0, i - CONTEXT_LINES);
    const to = Math.min(ops.length - 1, i + CONTEXT_LINES);
    const last = hunks.at(-1);
    if (last && from <= last[1] + 1) last[1] = Math.max(last[1], to);
    else hunks.push([from, to]);
  }

  const totalLines = snap.code.split("\n").length;
  const width = String(totalLines).length;
  let shown = 0;
  const blocks = hunks.map(([from, to]) => {
    const slice = ops.slice(from, to + 1);
    shown += slice.length;
    const added = slice.filter((o) => o.kind === "add").length;
    const removed = slice.filter((o) => o.kind === "del").length;
    const nums = slice.flatMap((o) => (o.newLine ? [o.newLine] : []));
    const where = nums.length ? `lines ${Math.min(...nums)}-${Math.max(...nums)}` : "end of file";
    const rows = slice.map((o) => {
      if (o.kind === "del") return `-${" ".repeat(width)}| ${o.text}`;
      return `${o.kind === "add" ? "+" : " "}${numbered(o.newLine!, width)}| ${o.text}`;
    });
    return `@@ ${where} (${added} added, ${removed} removed)\n${rows.join("\n")}`;
  });
  if (shown > MAX_DIFF_LINES) return null;

  const added = ops.filter((o) => o.kind === "add").length;
  const removed = ops.filter((o) => o.kind === "del").length;
  return `Code update v${snap.version} (${snap.language}, ${totalLines} lines now, about ${Math.floor(minutesIn)} min in). Only what changed since v${prev.version}; everything else is the same as before. Lines marked + are new, - are gone, and numbers are for the new version:
${blocks.join("\n")}
In total: ${added} line${added === 1 ? "" : "s"} added, ${removed} removed.`;
}

const isShort = (code: string) =>
  code.length <= SHORT_FILE_CHARS && code.split("\n").length <= SHORT_FILE_LINES;

// the message to send the model for this snapshot, or null if nothing changed since last time
export function codeContextMessage(
  prev: ForwardedCode | null,
  snap: CodeSnapshot,
  minutesIn: number,
): CodeMessage | null {
  if (prev && prev.code === snap.code && prev.language === snap.language) return null;

  const full = (): CodeMessage => ({
    kind: "full",
    text: fullMessage(snap, minutesIn),
    forwarded: {
      version: snap.version,
      language: snap.language,
      code: snap.code,
      diffsSinceFull: 0,
    },
  });

  if (!prev || prev.language !== snap.language || isShort(snap.code)) return full();
  if (prev.diffsSinceFull + 1 >= FULL_RESEND_EVERY) return full();

  const ops = diffLines(prev.code.split("\n"), snap.code.split("\n"));
  const text = ops && diffMessage(prev, snap, ops, minutesIn);
  if (!text) return full();
  return {
    kind: "diff",
    text,
    forwarded: {
      version: snap.version,
      language: snap.language,
      code: snap.code,
      diffsSinceFull: prev.diffsSinceFull + 1,
    },
  };
}
