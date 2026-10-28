"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import type {
  AttachCallRequest,
  RealtimeSessionRequest,
  RealtimeSessionResponse,
} from "@rehearse/shared";
import { SERVER_URL } from "@/lib/config";
import { createOnsetDetector, type OnsetDetector } from "./audioOnset";
import { createLatencyTracker } from "./latency";
import { micError } from "./micErrors";
import { connectRealtime, RealtimeCallError, type RealtimeConnection } from "./realtimeTransport";
import { transcriptReducer } from "./transcriptReducer";
import type { InterviewerState, RealtimeEvent, VoiceError, VoiceStatus } from "./types";

// keep sending mic audio a beat after release, so the last word survives the network trip
const RELEASE_TAIL_MS = 250;
// shorter than this is a tap, not speech. committing it just earns an "empty buffer" error
const MIN_HOLD_MS = 300;

const trackOf = (stream: MediaStream | null) => stream?.getAudioTracks()[0];

// hands the call to the server, which joins it to run phases, hints, and instructions.
// if this fails the call still works on its opening instructions, just without phase changes
async function attachToServer(sessionId: string, callId: string | null) {
  if (!callId) {
    console.warn("no call id from OpenAI, interviewer phases won't advance");
    return;
  }
  const body: AttachCallRequest = { callId };
  const res = await fetch(`${SERVER_URL}/api/realtime/session/${sessionId}/attach`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) console.warn("attaching interviewer to call failed", res.status);
}

// what went wrong, in words that point at the real fix
function describeStartError(err: unknown): VoiceError {
  if (err instanceof SessionRequestError) return { kind: "server", message: err.message };
  if (err instanceof RealtimeCallError) {
    if (err.code === "insufficient_quota" || err.code === "credit_balance_exhausted") {
      return {
        kind: "server",
        message:
          "The OpenAI account behind this server is out of credits. Add credits in OpenAI's billing settings, then try again.",
      };
    }
    if (err.status === 429)
      return {
        kind: "server",
        message: "The voice service is busy right now. Wait a moment and try again.",
      };
    if (err.status === 401 || err.status === 403) {
      return {
        kind: "server",
        message: "The voice service rejected this session. Check the server's OPENAI_API_KEY.",
      };
    }
    return {
      kind: "server",
      message: `The voice service couldn't start the call (${err.status}). Try again in a moment.`,
    };
  }
  return {
    kind: "connection",
    message: "Couldn't reach the interviewer. Check your connection and try again.",
  };
}

// the server said no (missing key, rate limit). its message is safe to show as-is
class SessionRequestError extends Error {}

// everything voice lives here: mic, token, WebRTC, event handling, transcript, latency.
// the UI only sees state and a few actions
export function useVoiceSession(problemId: string) {
  const [status, setStatus] = useState<VoiceStatus>("idle");
  // our interview session on the server; code sync joins it over the websocket
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<VoiceError | null>(null);
  const [holding, setHolding] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [awaitingReply, setAwaitingReply] = useState(false);
  const [muted, setMutedState] = useState(false);
  const [lines, dispatch] = useReducer(transcriptReducer, []);

  // mutable session bits that shouldn't trigger renders
  const conn = useRef<RealtimeConnection | null>(null);
  const mic = useRef<MediaStream | null>(null);
  const audioEl = useRef<HTMLAudioElement | null>(null);
  const audioCtx = useRef<AudioContext | null>(null);
  const onset = useRef<OnsetDetector | null>(null);
  const latency = useRef(createLatencyTracker());
  const startedAt = useRef(0);
  const holdStartedAt = useRef(0);
  const releaseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mutedRef = useRef(false);
  const responseActive = useRef(false);
  const speakingRef = useRef(false);
  const currentResponseId = useRef<string | null>(null);
  // the reply you talked over. its leftover audio events shouldn't unmute playback
  const interruptedResponseId = useRef<string | null>(null);

  const teardown = useCallback(() => {
    setSessionId(null);
    if (releaseTimer.current) clearTimeout(releaseTimer.current);
    releaseTimer.current = null;
    conn.current?.close();
    conn.current = null;
    mic.current?.getTracks().forEach((t) => t.stop());
    mic.current = null;
    if (audioEl.current) {
      audioEl.current.srcObject = null;
      audioEl.current.muted = false;
    }
    onset.current?.close();
    latency.current.cancel();
    responseActive.current = false;
    speakingRef.current = false;
    currentResponseId.current = null;
    interruptedResponseId.current = null;
    setHolding(false);
    setSpeaking(false);
    setAwaitingReply(false);
  }, []);

  const onEvent = useCallback((event: RealtimeEvent) => {
    dispatch({ event, at: Math.round((Date.now() - startedAt.current) / 1000) });
    const responseId = (event.response as { id?: string } | undefined)?.id ?? event.response_id;

    switch (event.type) {
      case "response.created":
        responseActive.current = true;
        currentResponseId.current = typeof responseId === "string" ? responseId : null;
        latency.current.mark("responseCreated");
        break;
      case "response.output_audio_transcript.delta":
        latency.current.mark("firstText");
        break;
      case "response.done":
        responseActive.current = false;
        setAwaitingReply(false);
        break;
      // WebRTC-only: when the server starts and stops streaming the interviewer's audio
      case "output_audio_buffer.started":
        if (responseId === interruptedResponseId.current) break;
        // the server can start the interviewer on its own now (hints, test results). if the
        // candidate is holding the mic right then, they win: cut the interviewer off at once
        if (trackOf(mic.current)?.enabled) {
          if (audioEl.current) audioEl.current.muted = true;
          interruptedResponseId.current = typeof responseId === "string" ? responseId : null;
          conn.current?.send({ type: "response.cancel" });
          conn.current?.send({ type: "output_audio_buffer.clear" });
          break;
        }
        if (audioEl.current) audioEl.current.muted = false;
        speakingRef.current = true;
        setSpeaking(true);
        setAwaitingReply(false);
        latency.current.mark("serverAudio");
        break;
      case "output_audio_buffer.stopped":
      case "output_audio_buffer.cleared":
        // a late event from the reply you talked over says nothing about the current turn
        if (responseId === interruptedResponseId.current) break;
        speakingRef.current = false;
        setSpeaking(false);
        // reply over and the onset detector never fired: still log the timings we got
        onset.current?.disarm();
        latency.current.flush();
        break;
      case "error":
        // usually recoverable (bad event, nothing to cancel). log it, don't kill the call
        console.warn("realtime error", event.error);
        setAwaitingReply(false);
        break;
    }
  }, []);

  const start = useCallback(async () => {
    teardown();
    dispatch({ reset: true });
    setError(null);
    setStatus("mic-prompt");

    // made before any await so it's tied to the click; otherwise browsers start it suspended
    audioCtx.current ??= new AudioContext();
    void audioCtx.current.resume();
    onset.current = createOnsetDetector(audioCtx.current);

    if (!navigator.mediaDevices?.getUserMedia) {
      setError({
        kind: "unsupported",
        message:
          "This browser can't access a microphone here. Use a recent Chrome, Edge, Firefox, or Safari over https or localhost.",
      });
      setStatus("error");
      return;
    }

    try {
      mic.current = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
    } catch (err) {
      setError(micError(err));
      setStatus("error");
      return;
    }
    // push-to-talk: the mic only feeds the call while the button is held
    const track = mic.current.getAudioTracks()[0];
    if (track) track.enabled = false;
    setStatus("connecting");

    try {
      const request: RealtimeSessionRequest = { problemId };
      const res = await fetch(`${SERVER_URL}/api/realtime/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new SessionRequestError(body?.error ?? "Could not start a voice session");
      }
      const session = (await res.json()) as RealtimeSessionResponse;

      audioEl.current ??= new Audio();
      audioEl.current.autoplay = true;
      startedAt.current = Date.now();

      conn.current = await connectRealtime({
        clientSecret: session.clientSecret,
        mic: mic.current,
        audioEl: audioEl.current,
        onRemoteStream: (stream) => onset.current?.attach(stream),
        onEvent,
        onConnectionLost: () => {
          teardown();
          setError({
            kind: "connection",
            message: "Lost the connection to the interviewer. Start again to reconnect.",
          });
          setStatus("error");
        },
      });
      setSessionId(session.sessionId);
      // not awaited: the interviewer can start talking while the server joins
      attachToServer(session.sessionId, conn.current.callId).catch((err) =>
        console.warn("attaching interviewer to call failed", err),
      );
    } catch (err) {
      teardown();
      console.error("voice session failed to start", err);
      setError(describeStartError(err));
      setStatus("error");
      return;
    }

    setStatus("live");
    // let the interviewer open: greeting plus the problem, per the system prompt
    conn.current?.send({ type: "response.create" });
    setAwaitingReply(true);
  }, [onEvent, teardown, problemId]);

  const end = useCallback(() => {
    teardown();
    setStatus("ended");
  }, [teardown]);

  // drop the turn in progress without sending it
  const abandonTurn = useCallback(() => {
    if (releaseTimer.current) clearTimeout(releaseTimer.current);
    releaseTimer.current = null;
    const track = trackOf(mic.current);
    if (track) track.enabled = false;
    conn.current?.send({ type: "input_audio_buffer.clear" });
    latency.current.cancel();
    setHolding(false);
  }, []);

  const setTalking = useCallback((down: boolean) => {
    const c = conn.current;
    const track = trackOf(mic.current);
    if (!c || !track) return;

    if (down) {
      if (mutedRef.current) return;
      // pressed again during the release tail: just keep going with the same turn
      if (releaseTimer.current) {
        clearTimeout(releaseTimer.current);
        releaseTimer.current = null;
        latency.current.cancel();
        setHolding(true);
        return;
      }
      // barge in. muting locally is what makes it instant: audio already buffered in the
      // browser would otherwise keep playing until the server's clear catches up
      const wasSpeaking = speakingRef.current;
      if (wasSpeaking || responseActive.current) {
        if (audioEl.current) audioEl.current.muted = true;
        interruptedResponseId.current = currentResponseId.current;
        speakingRef.current = false;
        setSpeaking(false);
        setAwaitingReply(false);
      }
      if (responseActive.current) c.send({ type: "response.cancel" });
      if (wasSpeaking) c.send({ type: "output_audio_buffer.clear" });
      c.send({ type: "input_audio_buffer.clear" });
      onset.current?.disarm();
      latency.current.cancel();
      track.enabled = true;
      holdStartedAt.current = Date.now();
      setHolding(true);
      return;
    }

    if (!track.enabled || releaseTimer.current) return;
    setHolding(false);
    latency.current.release();
    const heldFor = Date.now() - holdStartedAt.current;
    releaseTimer.current = setTimeout(() => {
      releaseTimer.current = null;
      track.enabled = false;
      if (heldFor < MIN_HOLD_MS) {
        c.send({ type: "input_audio_buffer.clear" });
        latency.current.cancel();
        return;
      }
      c.send({ type: "input_audio_buffer.commit" });
      c.send({ type: "response.create" });
      latency.current.mark("commit");
      onset.current?.arm(() => latency.current.mark("heard"));
      setAwaitingReply(true);
    }, RELEASE_TAIL_MS);
  }, []);

  // muting cuts the mic right away, even mid-turn, and nothing from that turn gets sent
  const setMuted = useCallback(
    (next: boolean) => {
      mutedRef.current = next;
      setMutedState(next);
      if (next && (trackOf(mic.current)?.enabled || releaseTimer.current)) abandonTurn();
    },
    [abandonTurn],
  );

  // leaving the page hangs up and releases the mic
  useEffect(
    () => () => {
      teardown();
      void audioCtx.current?.close();
      audioCtx.current = null;
    },
    [teardown],
  );

  const state: InterviewerState = holding
    ? "listening"
    : speaking
      ? "speaking"
      : awaitingReply
        ? "thinking"
        : "idle";

  return {
    status,
    error,
    sessionId,
    lines,
    state,
    holding,
    muted,
    start,
    end,
    setTalking,
    setMuted,
  };
}
