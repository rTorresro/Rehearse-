import type { Server } from "node:http";
import { WebSocketServer, type WebSocket } from "ws";
import {
  LANGUAGES,
  MAX_SNAPSHOT_CHARS,
  type ClientMessage,
  type CodeSnapshot,
  type ServerMessage,
} from "@rehearse/shared";
import type { InterviewController } from "./interview/controller.js";

type Options = {
  getInterview: (sessionId: string) => InterviewController | undefined;
  // browsers don't apply CORS to websockets, so the origin has to be checked by hand
  allowedOrigin: string;
};

// a snapshot plus some JSON overhead, with room to spare
const MAX_MESSAGE_BYTES = MAX_SNAPSHOT_CHARS * 4 + 1024;
// the client debounces to about one a second; anything much faster is a bug or abuse
const MIN_SNAPSHOT_GAP_MS = 200;

function send(socket: WebSocket, msg: ServerMessage) {
  socket.send(JSON.stringify(msg));
}

function parseSnapshot(msg: Record<string, unknown>): CodeSnapshot | null {
  const { version, timestamp, language, code } = msg;
  if (!Number.isSafeInteger(version) || (version as number) < 1) return null;
  if (typeof timestamp !== "number" || !Number.isFinite(timestamp)) return null;
  if (typeof language !== "string" || !(LANGUAGES as readonly string[]).includes(language))
    return null;
  if (typeof code !== "string" || code.length > MAX_SNAPSHOT_CHARS) return null;
  return {
    version: version as number,
    timestamp,
    language: language as CodeSnapshot["language"],
    code,
  };
}

// code sync: the browser joins its interview session, then sends debounced editor snapshots.
// rides on the same http server so dev only needs one port
export function attachInterviewSocket(server: Server, { getInterview, allowedOrigin }: Options) {
  const wss = new WebSocketServer({
    server,
    path: "/ws",
    maxPayload: MAX_MESSAGE_BYTES,
    verifyClient: ({ origin }: { origin?: string }) => origin === allowedOrigin,
  });

  wss.on("connection", (socket) => {
    let interview: InterviewController | undefined;
    let lastSnapshotAt = 0;
    let stopHints: (() => void) | undefined;
    socket.on("close", () => stopHints?.());

    socket.on("message", (raw) => {
      let msg: ClientMessage & Record<string, unknown>;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return send(socket, { type: "error", message: "bad json" });
      }

      if (msg.type === "session.join") {
        interview = typeof msg.sessionId === "string" ? getInterview(msg.sessionId) : undefined;
        if (!interview) {
          send(socket, { type: "error", message: "unknown or expired interview session" });
          return socket.close(4404, "unknown session");
        }
        send(socket, { type: "session.joined", sessionId: msg.sessionId });
        // the hint card starts from whatever is already unlocked, then follows along
        stopHints?.();
        send(socket, { type: "hints.state", ...interview.hints });
        stopHints = interview.onHintsChanged((state) =>
          send(socket, { type: "hints.state", ...state }),
        );
        return;
      }

      if (msg.type === "hint.request") {
        if (!interview) return send(socket, { type: "error", message: "join a session first" });
        // nothing left to unlock: just resend the state so the button settles
        if (!interview.requestHint()) send(socket, { type: "hints.state", ...interview.hints });
        return;
      }

      if (msg.type === "code.snapshot") {
        if (!interview) return send(socket, { type: "error", message: "join a session first" });
        const now = Date.now();
        if (now - lastSnapshotAt < MIN_SNAPSHOT_GAP_MS) return;
        lastSnapshotAt = now;
        const snapshot = parseSnapshot(msg);
        if (!snapshot) return send(socket, { type: "error", message: "malformed snapshot" });
        // stale versions are dropped quietly; the client only cares about acks for new ones
        if (interview.receiveCode(snapshot))
          send(socket, { type: "code.ack", version: snapshot.version });
        return;
      }

      send(socket, { type: "error", message: "unknown message type" });
    });
  });

  return wss;
}
