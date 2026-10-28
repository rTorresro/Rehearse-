import type { Language } from "@rehearse/shared";
import type { CodeRunner, ExecLimits, RunJob, RunOutcome, RunStatus } from "./types.js";

export type Judge0Config = {
  // e.g. https://ce.judge0.com, https://judge0-ce.p.rapidapi.com, or http://localhost:2358
  baseUrl: string;
  // auth differs per host: RapidAPI wants X-RapidAPI-Key/Host, self-hosted uses X-Auth-Token
  headers: Record<string, string>;
  // ids differ between Judge0 versions and instances; check GET /languages on yours
  languageIds: Record<Language, number>;
  pollIntervalMs?: number;
  // give up on the whole batch after this long
  timeoutMs?: number;
  fetch?: typeof fetch;
};

// Judge0 CE's defaults as of Oct 2026: Python 3.12.5, Node 22.08, JDK 17.0.6, GCC 14.1
export const JUDGE0_CE_LANGUAGE_IDS: Record<Language, number> = {
  python: 100,
  javascript: 102,
  java: 91,
  cpp: 105,
};

// Judge0 caps batch size; 20 on the public CE instance
const MAX_BATCH = 20;

type Judge0Result = {
  token?: string;
  status?: { id: number; description: string };
  stdout?: string | null;
  stderr?: string | null;
  compile_output?: string | null;
  message?: string | null;
  time?: string | null;
  memory?: number | null;
};

const b64 = (s: string) => Buffer.from(s, "utf8").toString("base64");
const unb64 = (s: string | null | undefined) =>
  s ? Buffer.from(s, "base64").toString("utf8") : "";

// Judge0 status ids: 1 queued, 2 processing, 3 accepted, 4 wrong answer (unused, we grade
// ourselves), 5 time limit, 6 compile error, 7-12 runtime errors, 13 internal, 14 exec format
function mapStatus(id: number): RunStatus {
  if (id === 3 || id === 4) return "ok";
  if (id === 5) return "time_limit";
  if (id === 6) return "compile_error";
  if (id >= 7 && id <= 12) return "runtime_error";
  return "internal_error";
}

const internal = (message: string): RunOutcome => ({
  status: "internal_error",
  stdout: "",
  stderr: "",
  compileOutput: "",
  timeMs: null,
  memoryKb: null,
  message,
});

export class Judge0Runner implements CodeRunner {
  private readonly fetch: typeof fetch;

  constructor(private readonly config: Judge0Config) {
    this.fetch = config.fetch ?? fetch;
  }

  async run(jobs: RunJob[], limits: ExecLimits): Promise<RunOutcome[]> {
    const out: RunOutcome[] = [];
    for (let i = 0; i < jobs.length; i += MAX_BATCH) {
      out.push(...(await this.runBatch(jobs.slice(i, i + MAX_BATCH), limits)));
    }
    return out;
  }

  private url(path: string) {
    return `${this.config.baseUrl.replace(/\/$/, "")}${path}`;
  }

  private async runBatch(jobs: RunJob[], limits: ExecLimits): Promise<RunOutcome[]> {
    const submissions = jobs.map((job) => ({
      language_id: this.config.languageIds[job.language],
      source_code: b64(job.source),
      stdin: b64(job.stdin),
      cpu_time_limit: limits.cpuTimeSec,
      wall_time_limit: limits.wallTimeSec,
      memory_limit: limits.memoryKb,
      max_file_size: limits.maxFileKb,
      enable_network: false,
    }));

    let created: { token?: string; error?: unknown }[];
    try {
      const res = await this.fetch(this.url("/submissions/batch?base64_encoded=true"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...this.config.headers },
        body: JSON.stringify({ submissions }),
      });
      if (!res.ok) {
        return jobs.map(() => internal(`code runner rejected the batch (${res.status})`));
      }
      created = (await res.json()) as typeof created;
    } catch (err) {
      return jobs.map(() => internal(`couldn't reach the code runner: ${(err as Error).message}`));
    }

    const tokens = created.map((c) => c.token);
    const results = new Map<string, Judge0Result>();
    const pending = () => tokens.filter((t): t is string => !!t && !results.has(t));
    const deadline = Date.now() + (this.config.timeoutMs ?? 60_000);
    let wait = this.config.pollIntervalMs ?? 500;

    while (pending().length > 0 && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, wait));
      // back off a little so a slow queue doesn't get hammered
      wait = Math.min(wait * 1.5, 3000);
      const fields = "token,status,stdout,stderr,compile_output,message,time,memory";
      try {
        const res = await this.fetch(
          this.url(
            `/submissions/batch?tokens=${pending().join(",")}&base64_encoded=true&fields=${fields}`,
          ),
          { headers: this.config.headers },
        );
        if (!res.ok) continue;
        const body = (await res.json()) as { submissions: Judge0Result[] };
        for (const r of body.submissions) {
          // 1 = in queue, 2 = processing; anything else is final
          if (r.token && r.status && r.status.id > 2) results.set(r.token, r);
        }
      } catch {
        // transient; try again next round
      }
    }

    return created.map((c) => {
      if (!c.token)
        return internal(`code runner refused this case: ${JSON.stringify(c.error ?? c)}`);
      const r = results.get(c.token);
      if (!r?.status) return internal("timed out waiting for the code runner");
      return {
        status: mapStatus(r.status.id),
        stdout: unb64(r.stdout),
        stderr: unb64(r.stderr),
        compileOutput: unb64(r.compile_output),
        timeMs: r.time ? Math.round(Number(r.time) * 1000) : null,
        memoryKb: r.memory ?? null,
        message: unb64(r.message) || r.status.description,
      };
    });
  }
}
