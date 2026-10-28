import cors from "cors";
import express from "express";
import type { HealthResponse } from "@rehearse/shared";
import { env } from "./env.js";
import type { CodeRunner, ExecLimits } from "./execution/types.js";
import type { ReportStore } from "./feedback/reports.js";
import { realtimeRouter } from "./realtime.js";
import { reportsRouter } from "./reportsRoute.js";
import { runRouter } from "./run.js";

// the runner is passed in so tests can swap Judge0 for a fake
export function createApp(deps: { runner: CodeRunner; limits: ExecLimits; reports: ReportStore }) {
  const app = express();
  app.use(cors({ origin: env.webOrigin }));
  // room for a max-size code payload plus JSON escaping
  app.use(express.json({ limit: "256kb" }));

  app.get("/health", (_req, res) => {
    const body: HealthResponse = { ok: true, uptime: process.uptime() };
    res.json(body);
  });

  app.use("/api/realtime", realtimeRouter(deps));
  app.use("/api/reports", reportsRouter(deps));
  app.use("/api/run", runRouter(deps));

  return app;
}
