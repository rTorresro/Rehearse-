import type { Difficulty, Problem, ProblemSummary, PublicProblem, Topic } from "@rehearse/shared";
import { ProblemSchema } from "./schema.ts";

// static imports so every bundler (Next, tsup, tsx) ships the JSON without touching the
// filesystem at runtime. the validate script fails if a file in data/ isn't listed here
import balancePoints from "../data/balance-points.json" with { type: "json" };
import buildWaves from "../data/build-waves.json" with { type: "json" };
import calmStreak from "../data/calm-streak.json" with { type: "json" };
import captionWrap from "../data/caption-wrap.json" with { type: "json" };
import echoWords from "../data/echo-words.json" with { type: "json" };
import heaviestLevel from "../data/heaviest-level.json" with { type: "json" };
import leafSpread from "../data/leaf-spread.json" with { type: "json" };
import mergeMeetingSlots from "../data/merge-meeting-slots.json" with { type: "json" };
import runLabels from "../data/run-labels.json" with { type: "json" };
import sharedShifts from "../data/shared-shifts.json" with { type: "json" };
import shipmentReconciliation from "../data/shipment-reconciliation.json" with { type: "json" };
import twoGifts from "../data/two-gifts.json" with { type: "json" };
import undoAndRedo from "../data/undo-and-redo.json" with { type: "json" };
import wellNestedTags from "../data/well-nested-tags.json" with { type: "json" };
import wifiDeadZones from "../data/wifi-dead-zones.json" with { type: "json" };

// parsed once at load, so a malformed problem crashes the server at startup, not mid-interview
export const PROBLEMS: readonly Problem[] = ProblemSchema.array().parse([
  balancePoints,
  buildWaves,
  calmStreak,
  captionWrap,
  echoWords,
  heaviestLevel,
  leafSpread,
  mergeMeetingSlots,
  runLabels,
  sharedShifts,
  shipmentReconciliation,
  twoGifts,
  undoAndRedo,
  wellNestedTags,
  wifiDeadZones,
]);

const byId = new Map(PROBLEMS.map((p) => [p.id, p]));

export function getProblem(id: string): Problem | undefined {
  return byId.get(id);
}

export function listProblems(): ProblemSummary[] {
  return PROBLEMS.map(({ id, title, difficulty, tags }) => ({ id, title, difficulty, tags }));
}

export type ProblemFilter = { difficulty?: Difficulty; topic?: Topic };

export function matchesFilter(p: ProblemSummary, f: ProblemFilter) {
  return (!f.difficulty || p.difficulty === f.difficulty) && (!f.topic || p.tags.includes(f.topic));
}

// what the browser is allowed to see: no hidden tests, hint text, pitfalls, or interviewer notes
export function toPublicProblem(p: Problem): PublicProblem {
  return {
    id: p.id,
    title: p.title,
    difficulty: p.difficulty,
    tags: p.tags,
    statement: p.statement,
    signature: p.signature,
    examples: p.examples,
    constraints: p.constraints,
    starterCode: p.starterCode,
    visibleTests: p.testCases.filter((t) => !t.hidden),
    hintCount: p.hints.length,
  };
}

export { ProblemSchema } from "./schema.ts";
