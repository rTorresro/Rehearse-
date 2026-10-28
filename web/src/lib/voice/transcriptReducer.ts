import type { RealtimeEvent, TranscriptLine } from "./types";

// turns realtime server events into ordered transcript lines.
// the candidate's transcription can land after the interviewer has started answering,
// so lines are placed by conversation order (previous_item_id), not by arrival time

export type TranscriptAction = { event: RealtimeEvent; at: number } | { reset: true };

type Role = TranscriptLine["role"];

function str(v: unknown) {
  return typeof v === "string" ? v : "";
}

function upsert(
  lines: TranscriptLine[],
  id: string,
  role: Role,
  at: number,
  patch: (line: TranscriptLine) => TranscriptLine,
  afterId?: string,
) {
  if (!id) return lines;
  const i = lines.findIndex((l) => l.id === id);
  if (i >= 0) return lines.map((l, j) => (j === i ? patch(l) : l));

  const line = patch({ id, role, at, text: "", partial: true });
  const after = afterId ? lines.findIndex((l) => l.id === afterId) : -1;
  if (after < 0) return [...lines, line];
  return [...lines.slice(0, after + 1), line, ...lines.slice(after + 1)];
}

export function transcriptReducer(lines: TranscriptLine[], action: TranscriptAction) {
  if ("reset" in action) return [];
  const { event: e, at } = action;

  switch (e.type) {
    case "conversation.item.added": {
      const item = e.item as { id?: string; type?: string; role?: string } | undefined;
      if (!item?.id || item.type !== "message") return lines;
      if (item.role !== "user" && item.role !== "assistant") return lines;
      const role: Role = item.role === "user" ? "candidate" : "interviewer";
      return upsert(lines, item.id, role, at, (l) => l, str(e.previous_item_id));
    }

    case "conversation.item.input_audio_transcription.delta":
      return upsert(lines, str(e.item_id), "candidate", at, (l) => ({
        ...l,
        text: l.text + str(e.delta),
      }));

    case "conversation.item.input_audio_transcription.completed":
      return upsert(lines, str(e.item_id), "candidate", at, (l) => ({
        ...l,
        text: str(e.transcript).trim(),
        partial: false,
      }));

    case "conversation.item.input_audio_transcription.failed":
      return upsert(lines, str(e.item_id), "candidate", at, (l) => ({
        ...l,
        text: l.text || "(couldn't make that out)",
        partial: false,
      }));

    case "response.output_audio_transcript.delta":
      return upsert(lines, str(e.item_id), "interviewer", at, (l) => ({
        ...l,
        text: l.text + str(e.delta),
      }));

    case "response.output_audio_transcript.done":
      return upsert(lines, str(e.item_id), "interviewer", at, (l) => ({
        ...l,
        text: str(e.transcript) || l.text,
        partial: false,
      }));

    // a cancelled (interrupted) response never sends transcript.done, so settle anything still open
    case "response.done":
      return lines.some((l) => l.role === "interviewer" && l.partial)
        ? lines.map((l) => (l.role === "interviewer" ? { ...l, partial: false } : l))
        : lines;

    default:
      return lines;
  }
}
