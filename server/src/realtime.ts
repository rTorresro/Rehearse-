import { randomUUID } from "node:crypto";
import { Router } from "express";
import { getProblem } from "@rehearse/problems";
import type {
  AttachCallRequest,
  EndInterviewResponse,
  RealtimeSessionRequest,
  RealtimeSessionResponse,
} from "@rehearse/shared";
import { env } from "./env.js";
import type { ReportStore } from "./feedback/reports.js";
import { createRateLimiter } from "./rateLimit.js";
import { InterviewController } from "./interview/controller.js";
import { registry } from "./interview/registry.js";
import { createSession } from "./interview/session.js";
import { openAISideband } from "./interview/sideband.js";

// the token only has to survive the browser's WebRTC handshake; the call keeps going after it expires
const TOKEN_TTL_SECONDS = 60;
// a session the browser never attached a call to is dead weight; drop it
const ATTACH_WINDOW_MS = 2 * 60_000;
// OpenAI call ids look like rtc_xxx. anything else isn't worth opening a socket for
const CALL_ID = /^rtc_[A-Za-z0-9_-]{1,128}$/;

// anyone who can reach this route can spend our OpenAI credit, so cap it per IP
const rateLimited = createRateLimiter({ windowMs: 60_000, max: 10 });

export function realtimeRouter(deps: { reports: ReportStore }) {
  const realtimeRouter = Router();

  realtimeRouter.post("/session", async (req, res) => {
    if (!env.openaiApiKey) {
      res.status(500).json({ error: "OPENAI_API_KEY is not set on the server" });
      return;
    }
    if (rateLimited(req.ip ?? "unknown")) {
      res.status(429).json({ error: "Too many sessions, try again in a minute" });
      return;
    }

    const { problemId } = (req.body ?? {}) as Partial<RealtimeSessionRequest>;
    const problem = typeof problemId === "string" ? getProblem(problemId) : undefined;
    if (!problem) {
      res.status(400).json({ error: "Unknown problem" });
      return;
    }

    const id = randomUUID();
    const controller = new InterviewController(
      createSession({ id, problem, startedAt: Date.now() }),
      {
        // however it ends (the End button or the call dropping), write the report from the record
        onEnded: (record) => {
          registry.delete(id);
          deps.reports.start(record);
        },
      },
    );

    const upstream = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.openaiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        expires_after: { anchor: "created_at", seconds: TOKEN_TTL_SECONDS },
        session: {
          ...controller.sessionConfig(),
          model: env.realtimeModel,
          audio: {
            input: {
              // transcribes the candidate's side so it shows up in the transcript panel
              transcription: { model: env.transcribeModel, language: "en" },
              noise_reduction: { type: "near_field" },
              // push-to-talk: the client commits audio when the mic button is released
              turn_detection: null,
            },
            output: { voice: env.realtimeVoice },
          },
        },
      }),
    });

    if (!upstream.ok) {
      // log the details for us, keep the browser's error generic
      console.error("client_secrets failed", upstream.status, await upstream.text());
      res.status(502).json({ error: "Could not start a voice session" });
      return;
    }

    registry.set(id, controller);
    setTimeout(() => {
      if (!controller.attached) registry.delete(id);
    }, ATTACH_WINDOW_MS).unref();

    const data = (await upstream.json()) as { value: string; expires_at: number };
    const body: RealtimeSessionResponse = {
      sessionId: id,
      clientSecret: data.value,
      expiresAt: data.expires_at,
      model: env.realtimeModel,
    };
    // never cache a credential
    res.set("Cache-Control", "no-store").json(body);
  });

  // the browser tells us which OpenAI call it opened, and the server joins it to run the interview
  realtimeRouter.post("/session/:id/attach", async (req, res) => {
    const controller = registry.get(req.params.id);
    const { callId } = (req.body ?? {}) as Partial<AttachCallRequest>;

    if (!controller) {
      res.status(404).json({ error: "Unknown or expired interview session" });
      return;
    }
    if (controller.attached) {
      res.status(409).json({ error: "This session already has a call attached" });
      return;
    }
    if (typeof callId !== "string" || !CALL_ID.test(callId)) {
      res.status(400).json({ error: "Missing or malformed callId" });
      return;
    }

    try {
      await controller.attach(callId, openAISideband(env.openaiApiKey));
    } catch (err) {
      console.error("sideband attach failed", err);
      res.status(502).json({ error: "Could not join the call" });
      return;
    }
    res.status(204).end();
  });

  // the End interview button. hangs up the server side and starts the feedback report
  realtimeRouter.post("/session/:id/end", (req, res) => {
    const id = req.params.id;
    const controller = registry.get(id);
    if (controller) controller.end();
    // already ended (say the call dropped first): the report is on its way regardless
    if (!controller && !deps.reports.get(id)) {
      res.status(404).json({ error: "Unknown or expired interview session" });
      return;
    }
    const body: EndInterviewResponse = { reportId: id };
    res.json(body);
  });

  return realtimeRouter;
}
