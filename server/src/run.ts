import { Router } from "express";
import { getProblem } from "@rehearse/problems";
import { LANGUAGES, MAX_SNAPSHOT_CHARS, type Language, type RunRequest } from "@rehearse/shared";
import { registry } from "./interview/registry.js";
import { createRateLimiter } from "./rateLimit.js";
import { runAgainstTests } from "./execution/service.js";
import type { CodeRunner, ExecLimits } from "./execution/types.js";

export function runRouter(deps: { runner: CodeRunner; limits: ExecLimits }) {
  const router = Router();
  // each run is a batch of real executions on a paid or shared service
  const rateLimited = createRateLimiter({ windowMs: 60_000, max: 20 });

  router.post("/", async (req, res) => {
    // only these four fields are read. test cases always come from the bank, so anything
    // else in the body, say a "tests" array, is simply ignored
    const { problemId, language, code, mode, sessionId } = (req.body ?? {}) as Partial<RunRequest>;

    const problem = typeof problemId === "string" ? getProblem(problemId) : undefined;
    if (!problem) return void res.status(400).json({ error: "Unknown problem" });
    if (typeof language !== "string" || !(LANGUAGES as readonly string[]).includes(language)) {
      return void res.status(400).json({ error: "Unsupported language" });
    }
    if (mode !== "run" && mode !== "submit")
      return void res.status(400).json({ error: "mode must be run or submit" });
    if (typeof code !== "string" || code.trim() === "")
      return void res.status(400).json({ error: "No code to run" });
    if (code.length > MAX_SNAPSHOT_CHARS)
      return void res.status(413).json({ error: "Code is too long" });
    if (rateLimited(req.ip ?? "unknown")) {
      return void res.status(429).json({ error: "Too many runs, wait a moment and try again" });
    }

    try {
      const result = await runAgainstTests({
        runner: deps.runner,
        problem,
        language: language as Language,
        code,
        mode,
        limits: deps.limits,
      });
      res.json(result);
      // the interviewer hears about it too, if this run belongs to a live interview
      if (typeof sessionId === "string")
        registry.get(sessionId)?.receiveRunResult(result, language as Language);
    } catch (err) {
      console.error("run failed", err);
      res.status(502).json({ error: "Couldn't run your code right now" });
    }
  });

  return router;
}
