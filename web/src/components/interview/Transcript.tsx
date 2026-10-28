"use client";

import { useEffect, useRef } from "react";
import type { TranscriptLine } from "@/lib/voice/types";
import { TranscriptMessage } from "./TranscriptMessage";

type Props = {
  lines: TranscriptLine[];
  // you're holding the mic: show a placeholder bubble until the transcription arrives
  pendingCandidate: boolean;
  captionsOn: boolean;
  emptyText: string;
};

export function Transcript({ lines, pendingCandidate, captionsOn, emptyText }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastText = lines.at(-1)?.text;

  // newest line at the bottom should be what you see, including while it streams
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines.length, lastText, pendingCandidate]);

  // announce finished lines only; reading every streamed word would be unbearable
  const lastFinal = lines.findLast((l) => !l.partial && l.text);

  return (
    <div ref={scrollRef} className="min-h-[220px] flex-1 overflow-y-auto px-6 pt-3 pb-4">
      <p aria-live="polite" className="sr-only">
        {lastFinal &&
          `${lastFinal.role === "interviewer" ? "Interviewer" : "You"}: ${lastFinal.text}`}
      </p>
      {!captionsOn ? (
        <p className="pt-6 text-center text-[13px] text-muted">Captions are off</p>
      ) : lines.length === 0 && !pendingCandidate ? (
        <p className="pt-6 text-center text-[13px] text-muted">{emptyText}</p>
      ) : (
        <ol aria-label="Transcript" className="flex flex-col gap-3.5">
          {lines.map((l) => (
            <TranscriptMessage key={l.id} entry={l} partial={l.partial} />
          ))}
          {pendingCandidate && (
            <TranscriptMessage
              entry={{ id: "pending", role: "candidate", at: 0, text: "" }}
              partial
              label="listening"
            />
          )}
        </ol>
      )}
    </div>
  );
}
