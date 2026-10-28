// TESTS ONLY. This runs code straight on this machine with no sandbox at all: no memory
// limit, no network block, full filesystem access. It exists so the harnesses can be
// checked against real compilers quickly. Never wire it into a route.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Language } from "@rehearse/shared";
import type { CodeRunner, ExecLimits, RunJob, RunOutcome } from "../types.js";

type Built = { cmd: string; args: string[] } | { compileError: string };

const has = (cmd: string, flag = "--version") =>
  spawnSync(cmd, [flag], { stdio: "ignore" }).status === 0;

// which languages this machine can actually run
export const localLanguages: Record<Language, boolean> = {
  python: has("python3"),
  javascript: has("node"),
  java: has("javac", "-version") && has("java", "-version"),
  cpp: has("g++"),
};

export class LocalRunner implements CodeRunner {
  private readonly root = mkdtempSync(join(tmpdir(), "rehearse-local-"));
  private readonly cache = new Map<string, Built>();

  private build(job: RunJob): Built {
    const key = createHash("sha256")
      .update(job.language + "\0" + job.source)
      .digest("hex")
      .slice(0, 16);
    const hit = this.cache.get(key);
    if (hit) return hit;
    const dir = join(this.root, key);
    mkdirSync(dir, { recursive: true });
    let built: Built;
    const compile = (cmd: string, args: string[]) => {
      const r = spawnSync(cmd, args, { encoding: "utf8", timeout: 60_000 });
      return r.status === 0 ? null : r.stderr || r.stdout || "compile failed";
    };
    switch (job.language) {
      case "python":
        writeFileSync(join(dir, "main.py"), job.source);
        built = { cmd: "python3", args: [join(dir, "main.py")] };
        break;
      case "javascript":
        writeFileSync(join(dir, "main.js"), job.source);
        built = { cmd: "node", args: [join(dir, "main.js")] };
        break;
      case "java": {
        writeFileSync(join(dir, "Main.java"), job.source);
        const err = compile("javac", ["-nowarn", "-d", dir, join(dir, "Main.java")]);
        built = err
          ? { compileError: err }
          : { cmd: "java", args: ["-Xss64m", "-cp", dir, "Main"] };
        break;
      }
      case "cpp": {
        writeFileSync(join(dir, "main.cpp"), job.source);
        const err = compile("g++", [
          "-std=c++17",
          "-O2",
          "-o",
          join(dir, "prog"),
          join(dir, "main.cpp"),
        ]);
        built = err ? { compileError: err } : { cmd: join(dir, "prog"), args: [] };
        break;
      }
    }
    this.cache.set(key, built);
    return built;
  }

  async run(jobs: RunJob[], limits: ExecLimits): Promise<RunOutcome[]> {
    return jobs.map((job) => {
      const built = this.build(job);
      const blank = {
        stdout: "",
        stderr: "",
        compileOutput: "",
        timeMs: null,
        memoryKb: null,
        message: "",
      };
      if ("compileError" in built)
        return { ...blank, status: "compile_error", compileOutput: built.compileError };
      const started = Date.now();
      const r = spawnSync(built.cmd, built.args, {
        input: job.stdin,
        encoding: "utf8",
        timeout: limits.wallTimeSec * 1000,
        killSignal: "SIGKILL",
        maxBuffer: 8 * 1024 * 1024,
      });
      const timeMs = Date.now() - started;
      const timedOut = (r.error as NodeJS.ErrnoException | undefined)?.code === "ETIMEDOUT";
      return {
        ...blank,
        status: timedOut ? "time_limit" : r.status === 0 ? "ok" : "runtime_error",
        stdout: r.stdout ?? "",
        stderr: r.stderr ?? "",
        timeMs,
        message: timedOut
          ? "Time limit exceeded"
          : r.status === 0
            ? ""
            : `exited with ${r.status ?? r.signal}`,
      };
    });
  }
}
