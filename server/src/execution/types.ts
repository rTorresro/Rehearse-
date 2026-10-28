import type { Language } from "@rehearse/shared";

// one program run: a complete source file plus what to feed it on stdin
export type RunJob = {
  language: Language;
  source: string;
  stdin: string;
};

export type ExecLimits = {
  cpuTimeSec: number;
  wallTimeSec: number;
  memoryKb: number;
  // how much the program may write to files; stdout is capped separately when grading
  maxFileKb: number;
};

export type RunStatus =
  "ok" | "compile_error" | "runtime_error" | "time_limit" | "memory_limit" | "internal_error";

export type RunOutcome = {
  status: RunStatus;
  stdout: string;
  stderr: string;
  compileOutput: string;
  // the runner's own measurement; on a busy shared instance it includes overhead
  timeMs: number | null;
  memoryKb: number | null;
  // human-readable detail from the runner, like "Time limit exceeded"
  message: string;
};

// what the rest of the server codes against. Judge0 is one implementation; a self-hosted
// Judge0 is the same one with a different URL, and anything else just has to fit this shape
export interface CodeRunner {
  run(jobs: RunJob[], limits: ExecLimits): Promise<RunOutcome[]>;
}
