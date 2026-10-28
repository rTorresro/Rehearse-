"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { ClientMessage, HintsState, ServerMessage } from "@rehearse/shared";
import { WS_URL } from "@/lib/config";
import { useVoice } from "@/lib/voice/VoiceSessionProvider";

const RECONNECT_MS = 2000;
const MAX_RECONNECTS = 5;

export type SocketStatus = "off" | "connecting" | "live" | "reconnecting";

type InterviewSocket = {
  status: SocketStatus;
  // goes up on every successful join, so code sync knows to resend after a reconnect
  joinCount: number;
  // false if the socket isn't joined right now
  send: (msg: ClientMessage) => boolean;
  ackedVersion: number;
  hints: HintsState | null;
  hintPending: boolean;
  requestHint: () => void;
};

const Ctx = createContext<InterviewSocket | null>(null);

type State = {
  sessionId: string | null;
  status: SocketStatus;
  joinCount: number;
  acked: number;
  hints: HintsState | null;
  hintPending: boolean;
};

const FRESH = {
  status: "connecting",
  joinCount: 0,
  acked: 0,
  hints: null,
  hintPending: false,
} as const;

// one websocket per live interview, shared by code sync and the hint card
export function InterviewSocketProvider({ children }: { children: ReactNode }) {
  const { sessionId } = useVoice();
  // tagged with the session it belongs to, so a new session starts fresh without an effect
  // having to reset it
  const [state, setState] = useState<State>({ sessionId: null, ...FRESH, status: "off" });
  const socket = useRef<WebSocket | null>(null);
  const joined = useRef(false);

  useEffect(() => {
    if (!sessionId) return;
    let disposed = false;
    let attempts = 0;
    let retry: ReturnType<typeof setTimeout> | null = null;
    const patch = (p: Partial<State>) =>
      setState((prev) => ({
        ...(prev.sessionId === sessionId ? prev : { sessionId, ...FRESH }),
        ...p,
      }));

    const open = () => {
      const ws = new WebSocket(WS_URL);
      socket.current = ws;
      joined.current = false;

      ws.addEventListener("open", () => {
        const join: ClientMessage = { type: "session.join", sessionId };
        ws.send(JSON.stringify(join));
      });
      ws.addEventListener("message", (e) => {
        let msg: ServerMessage;
        try {
          msg = JSON.parse(String(e.data));
        } catch {
          return;
        }
        switch (msg.type) {
          case "session.joined":
            joined.current = true;
            attempts = 0;
            setState((prev) => {
              const base = prev.sessionId === sessionId ? prev : { sessionId, ...FRESH };
              return { ...base, status: "live", joinCount: base.joinCount + 1 };
            });
            break;
          case "code.ack":
            setState((prev) =>
              prev.sessionId === sessionId
                ? { ...prev, acked: Math.max(prev.acked, msg.version) }
                : prev,
            );
            break;
          case "hints.state":
            patch({ hints: { unlocked: msg.unlocked, total: msg.total }, hintPending: false });
            break;
          case "error":
            console.warn("interview socket:", msg.message);
            break;
        }
      });
      ws.addEventListener("close", (e) => {
        joined.current = false;
        if (disposed) return;
        // 4404 = the session is gone; retrying won't bring it back
        if (e.code === 4404 || attempts >= MAX_RECONNECTS) return patch({ status: "off" });
        attempts++;
        patch({ status: "reconnecting" });
        retry = setTimeout(open, RECONNECT_MS);
      });
    };
    open();

    return () => {
      disposed = true;
      if (retry) clearTimeout(retry);
      socket.current?.close();
      socket.current = null;
      joined.current = false;
    };
  }, [sessionId]);

  const send = useCallback((msg: ClientMessage) => {
    const ws = socket.current;
    if (!ws || ws.readyState !== WebSocket.OPEN || !joined.current) return false;
    ws.send(JSON.stringify(msg));
    return true;
  }, []);

  const requestHint = useCallback(() => {
    if (send({ type: "hint.request" })) {
      setState((prev) => ({ ...prev, hintPending: true }));
    }
  }, [send]);

  const current = state.sessionId === sessionId;
  const value: InterviewSocket = {
    // before the first message for this session arrives, we're connecting
    status: !sessionId ? "off" : current ? state.status : "connecting",
    joinCount: current ? state.joinCount : 0,
    send,
    ackedVersion: current ? state.acked : 0,
    hints: current ? state.hints : null,
    hintPending: current && state.hintPending,
    requestHint,
  };
  return <Ctx value={value}>{children}</Ctx>;
}

export function useInterviewSocket() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useInterviewSocket needs an InterviewSocketProvider above it");
  return ctx;
}
