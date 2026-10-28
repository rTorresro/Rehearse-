// types and plain constants only, so both apps can import this as raw TS with no build step.
// the problem bank's runtime schema (zod) lives in @rehearse/problems and is checked against these
// keep it to this one file: no relative imports means no .js-vs-.ts resolution headaches

// languages every problem ships starter code for
export const LANGUAGES = ["python", "javascript", "java", "cpp"] as const;
export type Language = (typeof LANGUAGES)[number];

export type Difficulty = "easy" | "medium" | "hard";

// the topics the problem picker filters on. every problem has at least one
export const TOPICS = [
  "arrays",
  "strings",
  "hashing",
  "two-pointers",
  "stacks",
  "trees",
  "graphs",
] as const;
export type Topic = (typeof TOPICS)[number];

// finer-grained technique tags, shown on the problem but not used for picking
export const TECHNIQUE_TAGS = [
  "sorting",
  "prefix-sums",
  "sliding-window",
  "simulation",
  "bfs",
  "dfs",
  "topological-sort",
] as const;
export type Tag = Topic | (typeof TECHNIQUE_TAGS)[number];

// the small type vocabulary test values use, so one test case can drive every language.
// "tree" is a binary tree in level order with null for missing children
export const VALUE_TYPES = [
  "int",
  "int[]",
  "int[][]",
  "string",
  "string[]",
  "bool",
  "tree",
] as const;
export type ValueType = (typeof VALUE_TYPES)[number];

export interface FunctionSignature {
  // camelCase; the python starter uses the snake_case version
  name: string;
  params: { name: string; type: ValueType }[];
  returns: ValueType;
}

export interface ProblemExample {
  input: string;
  output: string;
  explanation?: string;
}

export interface TestCase {
  // one JSON value per signature param, in order
  args: unknown[];
  expected: unknown;
  // hidden cases are only used for grading; the candidate never sees them
  hidden: boolean;
}

// the full problem as stored in the bank. server-side only: it has hidden tests, hints,
// and interviewer notes. the browser gets a PublicProblem instead
export interface Problem {
  id: string;
  title: string;
  difficulty: Difficulty;
  tags: Tag[];
  // paragraphs. `backticks` render as code and ^n as a superscript
  statement: string[];
  signature: FunctionSignature;
  examples: ProblemExample[];
  constraints: string[];
  starterCode: Record<Language, string>;
  testCases: TestCase[];
  // in order, each a bit more revealing than the last
  hints: [string, string, string];
  // mistakes candidates commonly make, so the interviewer knows what to watch for
  pitfalls: string[];
  // the best achievable, as big-O strings like "O(n log n)"
  complexity: { time: string; space: string };
  // what to probe: the questions that separate a strong answer from an okay one
  interviewerNotes: string[];
}

// safe to send to the browser
export interface PublicProblem {
  id: string;
  title: string;
  difficulty: Difficulty;
  tags: Tag[];
  statement: string[];
  signature: FunctionSignature;
  examples: ProblemExample[];
  constraints: string[];
  starterCode: Record<Language, string>;
  visibleTests: TestCase[];
  hintCount: number;
}

// what the picker needs
export interface ProblemSummary {
  id: string;
  title: string;
  difficulty: Difficulty;
  tags: Tag[];
}

// in order. the server's state machine only ever moves forward through this list
export const INTERVIEW_PHASES = ["intro", "approach", "coding", "follow_ups", "wrap_up"] as const;
export type InterviewPhase = (typeof INTERVIEW_PHASES)[number];

// POST /api/run. the server picks the test cases from the bank, never from the request
export interface RunRequest {
  problemId: string;
  language: Language;
  code: string;
  // run = visible cases only, submit = every case, hidden ones included
  mode: "run" | "submit";
  // the live interview, if there is one, so the interviewer hears how the run went
  sessionId?: string;
}

export type CaseStatus =
  | "passed"
  | "failed"
  | "compile_error"
  | "runtime_error"
  | "time_limit"
  | "memory_limit"
  | "output_limit"
  | "internal_error";

export interface CaseResult {
  // position in the problem's test list
  index: number;
  hidden: boolean;
  status: CaseStatus;
  runtimeMs: number | null;
  memoryKb: number | null;
  // the rest is only filled in for visible cases. hidden ones never reveal their data
  input?: string;
  expected?: string;
  actual?: string;
  // what the code printed, trimmed to a sane size
  stdout?: string;
  error?: string;
}

export type RunVerdict = "accepted" | "wrong_answer" | Exclude<CaseStatus, "passed" | "failed">;

export interface RunResponse {
  mode: RunRequest["mode"];
  verdict: RunVerdict;
  passed: number;
  total: number;
  // set when the code didn't compile; every case then has status compile_error
  compileError?: string;
  cases: CaseResult[];
}

export interface TranscriptEntry {
  id: string;
  role: "interviewer" | "candidate";
  // seconds from interview start
  at: number;
  text: string;
}

// a point-in-time copy of the editor, sent over the websocket while an interview is live
export interface CodeSnapshot {
  // goes up by one per snapshot sent. the server ignores anything older than what it has
  version: number;
  // when the browser took it, ms since epoch
  timestamp: number;
  language: Language;
  code: string;
}

// biggest snapshot the server accepts. far beyond any interview answer
export const MAX_SNAPSHOT_CHARS = 50_000;

// a hint the candidate has unlocked, in the order the server released it
export interface UnlockedHint {
  number: number;
  text: string;
}

export interface HintsState {
  unlocked: UnlockedHint[];
  total: number;
}

// browser -> server over the websocket at /ws
export type ClientMessage =
  // ties this socket to the interview session from POST /api/realtime/session
  | { type: "session.join"; sessionId: string }
  | ({ type: "code.snapshot" } & CodeSnapshot)
  // the hint button. the server decides which hint comes next
  | { type: "hint.request" };

// server -> browser over the websocket
export type ServerMessage =
  | { type: "session.joined"; sessionId: string }
  | { type: "code.ack"; version: number }
  // sent on join and whenever a hint unlocks, whether by voice or by the button
  | ({ type: "hints.state" } & HintsState)
  | { type: "error"; message: string };

export interface HealthResponse {
  ok: true;
  uptime: number;
}

export type ReportCategoryId =
  "communication" | "problem-solving" | "code-quality" | "complexity-analysis";

export interface ReportCategory {
  id: ReportCategoryId;
  label: string;
  score: number; // 0-100
  feedback: string;
  // what the score is based on: the candidate's own words or code, quoted exactly
  evidence: string[];
}

export interface KeyMoment {
  id: string;
  // seconds from interview start, so the transcript and code snapshots can share it
  at: number;
  kind: "strength" | "needs-work";
  title: string;
  description: string;
  // something the candidate actually said or wrote, word for word
  quote: string;
  // where to look: a range of transcript lines, or a saved version of the code
  ref: MomentRef;
}

export type MomentRef =
  { type: "transcript"; fromLine: number; toLine: number } | { type: "code"; version: number };

export interface ReportStats {
  hintsUsed: number;
  hintsTotal: number;
  testsPassedOnSubmit: number;
  testsTotal: number;
  runsBeforeSubmit: number;
}

// GET /api/reports/:id. reports take a minute to write, so the page polls this
export type ReportStatusResponse =
  | { status: "generating" }
  | { status: "ready"; report: InterviewReport }
  | { status: "failed"; error: string };

// GET /api/reports/:id/history: what the report's moments point at. line numbers are the
// L numbers the report cites; no test data, just what the candidate said and wrote
export interface ReportHistory {
  transcript: { line: number; at: number; role: "candidate" | "interviewer"; text: string }[];
  snapshots: { version: number; at: number; language: Language; code: string }[];
}

// POST /api/realtime/session/:id/end
export interface EndInterviewResponse {
  reportId: string;
}

export interface InterviewReport {
  id: string;
  problemTitle: string;
  difficulty: Difficulty;
  language: Language;
  date: string; // ISO
  durationSeconds: number;
  overallScore: number; // 0-100
  verdict: string;
  summary: string;
  stats: ReportStats;
  categories: ReportCategory[];
  moments: KeyMoment[];
}

// POST /api/realtime/session. the browser uses this short-lived secret to open
// its own WebRTC call to the voice provider, so the real API key never leaves the server
// POST /api/realtime/session body: which problem to interview on
export interface RealtimeSessionRequest {
  problemId: string;
}

export interface RealtimeSessionResponse {
  // our interview session on the server; the browser hands it back when attaching the call
  sessionId: string;
  clientSecret: string;
  expiresAt: number; // unix seconds
  model: string;
}

// POST /api/realtime/session/:id/attach. callId comes from the Location header of
// OpenAI's SDP answer; the server uses it to join the same call over a sideband socket
export interface AttachCallRequest {
  callId: string;
}
