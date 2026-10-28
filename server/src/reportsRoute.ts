import { Router } from "express";
import type { ReportStore } from "./feedback/reports.js";

// GET /api/reports/:id to poll, POST /api/reports/:id/retry after a failure.
// report ids are interview session ids: random uuids nobody else can guess
export function reportsRouter(deps: { reports: ReportStore }) {
  const router = Router();

  router.get("/:id", (req, res) => {
    const status = deps.reports.get(req.params.id);
    if (!status) return void res.status(404).json({ error: "No report for this interview" });
    res.set("Cache-Control", "no-store").json(status);
  });

  router.get("/:id/history", (req, res) => {
    const history = deps.reports.history(req.params.id);
    if (!history) return void res.status(404).json({ error: "No report for this interview" });
    res.set("Cache-Control", "no-store").json(history);
  });

  router.post("/:id/retry", (req, res) => {
    if (!deps.reports.get(req.params.id))
      return void res.status(404).json({ error: "No report for this interview" });
    if (!deps.reports.retry(req.params.id))
      return void res.status(409).json({ error: "Only a failed report can be retried" });
    res.status(202).json({ status: "generating" });
  });

  return router;
}
