import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Judge0Runner, JUDGE0_CE_LANGUAGE_IDS } from "./judge0.js";
import type { ExecLimits, RunJob } from "./types.js";

const limits: ExecLimits = { cpuTimeSec: 2, wallTimeSec: 4, memoryKb: 128_000, maxFileKb: 1024 };
const b64 = (s: string) => Buffer.from(s).toString("base64");
const job = (n: number): RunJob => ({ language: "python", source: "print(1)", stdin: `[${n}]` });

// a tiny fake Judge0: records requests, finishes each submission after one poll
function fakeJudge0(finish: (stdin: string, i: number) => object) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const stdins = new Map<string, string>();
  let polls = 0;
  const fake = (async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    if (init?.method === "POST") {
      const body = JSON.parse(String(init.body)) as { submissions: { stdin: string }[] };
      const created = body.submissions.map((s, i) => {
        const token = `t${stdins.size + i}`;
        return { token, stdin: Buffer.from(s.stdin, "base64").toString() };
      });
      for (const c of created) stdins.set(c.token, c.stdin);
      return new Response(JSON.stringify(created.map(({ token }) => ({ token }))), { status: 201 });
    }
    polls++;
    const tokens = new URL(url).searchParams.get("tokens")!.split(",");
    return new Response(
      JSON.stringify({
        submissions: tokens.map((token, i) =>
          polls === 1
            ? { token, status: { id: 2, description: "Processing" } }
            : { token, ...finish(stdins.get(token)!, i) },
        ),
      }),
    );
  }) as typeof fetch;
  return { fake, calls };
}

const runner = (fake: typeof fetch, extra = {}) =>
  new Judge0Runner({
    baseUrl: "https://judge0.test/",
    headers: { "X-Auth-Token": "secret" },
    languageIds: JUDGE0_CE_LANGUAGE_IDS,
    pollIntervalMs: 1,
    fetch: fake,
    ...extra,
  });

describe("Judge0Runner", () => {
  it("submits with limits, polls until done, and decodes base64 output", async () => {
    const { fake, calls } = fakeJudge0((stdin) => ({
      status: { id: 3, description: "Accepted" },
      stdout: b64(`got ${stdin}`),
      time: "0.123",
      memory: 9000,
    }));
    const [out] = await runner(fake).run([job(7)], limits);
    assert.deepEqual(out, {
      status: "ok",
      stdout: "got [7]",
      stderr: "",
      compileOutput: "",
      timeMs: 123,
      memoryKb: 9000,
      message: "Accepted",
    });
    const sent = JSON.parse(String(calls[0]!.init!.body)).submissions[0];
    assert.equal(calls[0]!.url, "https://judge0.test/submissions/batch?base64_encoded=true");
    assert.equal(sent.language_id, 100);
    assert.equal(sent.cpu_time_limit, 2);
    assert.equal(sent.wall_time_limit, 4);
    assert.equal(sent.memory_limit, 128_000);
    assert.equal(sent.enable_network, false);
    assert.equal((calls[0]!.init!.headers as Record<string, string>)["X-Auth-Token"], "secret");
  });

  it("splits into batches of 20 and keeps results in order", async () => {
    const { fake, calls } = fakeJudge0((stdin) => ({
      status: { id: 3, description: "Accepted" },
      stdout: b64(stdin),
    }));
    const out = await runner(fake).run(
      Array.from({ length: 45 }, (_, i) => job(i)),
      limits,
    );
    assert.equal(calls.filter((c) => c.init?.method === "POST").length, 3);
    assert.deepEqual(
      out.map((o) => o.stdout),
      Array.from({ length: 45 }, (_, i) => `[${i}]`),
    );
  });

  it("maps Judge0 statuses", async () => {
    const statuses = [5, 6, 7, 11, 13];
    const { fake } = fakeJudge0((_s, i) => ({
      status: { id: statuses[i], description: "x" },
      compile_output: statuses[i] === 6 ? b64("main.cpp:1: error") : null,
      message: b64("from isolate"),
    }));
    const out = await runner(fake).run(
      statuses.map((_, i) => job(i)),
      limits,
    );
    assert.deepEqual(
      out.map((o) => o.status),
      ["time_limit", "compile_error", "runtime_error", "runtime_error", "internal_error"],
    );
    assert.equal(out[1]!.compileOutput, "main.cpp:1: error");
    assert.equal(out[0]!.message, "from isolate");
  });

  it("turns an unreachable runner into internal errors instead of throwing", async () => {
    const down = (async () => {
      throw new Error("ECONNREFUSED");
    }) as unknown as typeof fetch;
    const out = await runner(down).run([job(1), job(2)], limits);
    assert.deepEqual(
      out.map((o) => o.status),
      ["internal_error", "internal_error"],
    );
    assert.match(out[0]!.message, /couldn't reach the code runner/);
  });

  it("gives up after its timeout", async () => {
    const { fake } = fakeJudge0(() => ({ status: { id: 1, description: "In Queue" } }));
    const out = await runner(fake, { timeoutMs: 30 }).run([job(1)], limits);
    assert.equal(out[0]!.status, "internal_error");
    assert.match(out[0]!.message, /timed out/);
  });
});
