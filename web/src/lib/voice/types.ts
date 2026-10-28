import type { TranscriptEntry } from "@rehearse/shared";

// what the orb shows. idle = connected and waiting for the candidate
export type InterviewerState = "idle" | "speaking" | "thinking" | "listening";

// mic-prompt = the browser's permission prompt is open and we're waiting on the user
export type VoiceStatus = "idle" | "mic-prompt" | "connecting" | "live" | "ended" | "error";

export type VoiceErrorKind =
  "mic-denied" | "mic-missing" | "mic-busy" | "unsupported" | "server" | "connection";

export type VoiceError = { kind: VoiceErrorKind; message: string };

// partial = still streaming in
export type TranscriptLine = TranscriptEntry & { partial: boolean };

// loose on purpose: we only read the handful of fields we care about
export type RealtimeEvent = { type: string } & Record<string, unknown>;
