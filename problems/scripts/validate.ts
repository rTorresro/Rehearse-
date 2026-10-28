// checks every problem in data/: schema, test value types, starter code, and that the
// reference solution in solutions/ passes every test case. exits 1 on any failure.
// run with: npm run validate:problems (from the repo root)
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { isDeepStrictEqual } from "node:util";
import { TOPICS, type Problem, type ValueType } from "@rehearse/shared";
import { ProblemSchema } from "../src/schema.ts";

const DATA = new URL("../data/", import.meta.url);
// read as text, not imported: importing it parses every problem, and one bad file would
// crash this script before it could report anything useful
const INDEX_SOURCE = readFileSync(new URL("../src/index.ts", import.meta.url), "utf8");
const SOLUTIONS = new URL("../solutions/", import.meta.url);

const errors: string[] = [];
const fail = (id: string, msg: string) => errors.push(`${id}: ${msg}`);

const isInt = (v: unknown) => Number.isInteger(v);
const TYPE_CHECKS: Record<ValueType, (v: unknown) => boolean> = {
  int: isInt,
  "int[]": (v) => Array.isArray(v) && v.every(isInt),
  "int[][]": (v) => Array.isArray(v) && v.every((row) => Array.isArray(row) && row.every(isInt)),
  string: (v) => typeof v === "string",
  "string[]": (v) => Array.isArray(v) && v.every((s) => typeof s === "string"),
  bool: (v) => typeof v === "boolean",
  tree: isLevelOrderTree,
};

// level order with nulls: empty, or a non-null root and no children hanging off a missing node
function isLevelOrderTree(v: unknown): boolean {
  if (!Array.isArray(v)) return false;
  if (v.length === 0) return true;
  if (!v.every((x) => x === null || isInt(x)) || v[0] === null || v.at(-1) === null) return false;
  let slots = 2; // children the nodes seen so far can still take
  for (let i = 1; i < v.length; i++) {
    if (slots === 0) return false;
    slots--;
    if (v[i] !== null) slots += 2;
  }
  return true;
}

const snake = (name: string) => name.replace(/[A-Z]/g, (c) => "_" + c.toLowerCase());

function checkStarters(p: Problem) {
  const { name } = p.signature;
  const expectName: Record<keyof Problem["starterCode"], string> = {
    python: `def ${snake(name)}(`,
    javascript: `function ${name}(`,
    java: ` ${name}(`,
    cpp: ` ${name}(`,
  };
  for (const [lang, needle] of Object.entries(expectName)) {
    const code = p.starterCode[lang as keyof typeof expectName];
    if (!code.includes(needle)) fail(p.id, `${lang} starter doesn't define ${needle.trim()}`);
  }
  try {
    new Function(p.starterCode.javascript);
  } catch (e) {
    fail(p.id, `javascript starter doesn't parse: ${(e as Error).message}`);
  }
}

// one python process for every starter, if python is around
function checkPythonStarters(problems: Problem[]) {
  const script = `
import json, sys
for pid, code in json.load(sys.stdin):
    try:
        compile(code, pid, "exec")
    except SyntaxError as e:
        print(f"{pid}: python starter doesn't compile: {e}")
`;
  const input = JSON.stringify(problems.map((p) => [p.id, p.starterCode.python]));
  const run = spawnSync("python3", ["-I", "-c", script], { input, encoding: "utf8" });
  if (run.error) return console.warn("  (python3 not found, skipped python starter check)");
  for (const line of run.stdout.split("\n").filter(Boolean)) errors.push(line);
}

async function checkSolution(p: Problem) {
  const file = new URL(`${p.id}.ts`, SOLUTIONS);
  if (!existsSync(file)) return fail(p.id, `no reference solution at solutions/${p.id}.ts`);
  const solve = (await import(file.href)).default as (...args: unknown[]) => unknown;
  if (typeof solve !== "function") return fail(p.id, "reference solution has no default export");
  p.testCases.forEach((t, i) => {
    let actual: unknown;
    try {
      // clone so a solution that mutates its input can't corrupt the next check
      actual = solve(...structuredClone(t.args));
    } catch (e) {
      return fail(p.id, `test ${i} threw: ${(e as Error).message}`);
    }
    if (!isDeepStrictEqual(actual, t.expected)) {
      fail(p.id, `test ${i} expected ${JSON.stringify(t.expected)}, got ${JSON.stringify(actual)}`);
    }
  });
}

// the code runner's harnesses read trees as input but can't print one back, and their
// JSON readers only promise printable ASCII
const ASCII = /^[\x20-\x7e]*$/;
const allStrings = (v: unknown): string[] =>
  typeof v === "string" ? [v] : Array.isArray(v) ? v.flatMap(allStrings) : [];

function checkTests(p: Problem) {
  const { params, returns } = p.signature;
  if (returns === "tree") fail(p.id, "returning a tree isn't supported by the code runner");
  p.testCases.forEach((t, i) => {
    for (const s of [...allStrings(t.args), ...allStrings(t.expected)]) {
      if (!ASCII.test(s))
        fail(p.id, `test ${i} has a non-ASCII or control character in ${JSON.stringify(s)}`);
    }
  });
  const visible = p.testCases.filter((t) => !t.hidden).length;
  const hidden = p.testCases.length - visible;
  if (visible < 2) fail(p.id, `needs at least 2 visible test cases, has ${visible}`);
  if (hidden < 2) fail(p.id, `needs at least 2 hidden test cases, has ${hidden}`);
  p.testCases.forEach((t, i) => {
    if (t.args.length !== params.length) {
      return fail(p.id, `test ${i} has ${t.args.length} args, signature takes ${params.length}`);
    }
    params.forEach((param, j) => {
      if (!TYPE_CHECKS[param.type](t.args[j]))
        fail(p.id, `test ${i} arg "${param.name}" isn't a valid ${param.type}`);
    });
    if (!TYPE_CHECKS[returns](t.expected))
      fail(p.id, `test ${i} expected value isn't a valid ${returns}`);
  });
  const seen = new Set<string>();
  p.testCases.forEach((t, i) => {
    const key = JSON.stringify(t.args);
    if (seen.has(key)) fail(p.id, `test ${i} duplicates an earlier test's input`);
    seen.add(key);
  });
}

const files = readdirSync(DATA)
  .filter((f) => f.endsWith(".json"))
  .sort();
const valid: Problem[] = [];

for (const file of files) {
  const id = file.replace(/\.json$/, "");
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(new URL(file, DATA), "utf8"));
  } catch (e) {
    fail(id, `not valid JSON: ${(e as Error).message}`);
    continue;
  }
  const parsed = ProblemSchema.safeParse(raw);
  if (!parsed.success) {
    for (const issue of parsed.error.issues)
      fail(id, `${issue.path.join(".") || "(root)"}: ${issue.message}`);
    continue;
  }
  const p = parsed.data;
  if (p.id !== id) fail(id, `id "${p.id}" doesn't match the file name`);
  checkTests(p);
  checkStarters(p);
  await checkSolution(p);
  valid.push(p);
}

checkPythonStarters(valid);

// bank-wide
for (const p of valid) {
  if (!INDEX_SOURCE.includes(`"../data/${p.id}.json"`)) fail(p.id, "not imported in src/index.ts");
}
const titles = new Set<string>();
for (const p of valid) {
  if (titles.has(p.title)) fail(p.id, `title "${p.title}" is used twice`);
  titles.add(p.title);
}
for (const topic of TOPICS) {
  if (!valid.some((p) => p.tags.includes(topic)))
    errors.push(`bank: no problem covers topic "${topic}"`);
}
for (const level of ["easy", "medium"] as const) {
  if (!valid.some((p) => p.difficulty === level)) errors.push(`bank: no ${level} problems`);
}

const tests = valid.reduce((n, p) => n + p.testCases.length, 0);
if (errors.length) {
  console.error(`\n${errors.length} problem(s) found:\n`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log(`ok: ${valid.length} problems, ${tests} test cases, every reference solution passes`);
for (const t of TOPICS) {
  const ps = valid.filter((p) => p.tags.includes(t));
  console.log(`  ${t.padEnd(13)} ${ps.length}  (${ps.map((p) => p.difficulty[0]).join("")})`);
}
