import type { VoiceError } from "./types";

// getUserMedia fails with DOMExceptions whose names mean very different things to the user
export function micError(err: unknown): VoiceError {
  const name = err instanceof DOMException ? err.name : "";
  switch (name) {
    case "NotAllowedError":
    case "SecurityError":
      return {
        kind: "mic-denied",
        message:
          "Microphone access is blocked. Allow it from the site settings icon in your browser's address bar, then try again.",
      };
    case "NotFoundError":
    case "OverconstrainedError":
      return {
        kind: "mic-missing",
        message:
          "No microphone found. Plug one in or pick one in your system settings, then try again.",
      };
    case "NotReadableError":
    case "AbortError":
      return {
        kind: "mic-busy",
        message: "Your microphone is in use by another app. Close it there, then try again.",
      };
    default:
      return {
        kind: "mic-denied",
        message: "Couldn't start your microphone. Check its permissions and try again.",
      };
  }
}
