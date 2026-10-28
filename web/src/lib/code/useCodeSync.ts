"use client";

import { useCallback, useEffect, useRef } from "react";
import type { Language } from "@rehearse/shared";
import { useInterviewSocket } from "@/lib/interview/InterviewSocketProvider";
import { useVoice } from "@/lib/voice/VoiceSessionProvider";

// wait this long after the last keystroke before sending...
const DEBOUNCE_MS = 1000;
// ...but never sit on unsent changes longer than this while they keep typing
const MAX_WAIT_MS = 5000;

// sends debounced, versioned editor snapshots to the server while an interview is live,
// so the interviewer can see the code. never per keystroke
export function useCodeSync({ language, code }: { language: Language; code: string }) {
  const { sessionId } = useVoice();
  const sock = useInterviewSocket();
  const { send, joinCount } = sock;

  const latest = useRef({ language, code });
  const version = useRef(0);
  const lastSent = useRef<{ language: Language; code: string } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firstUnsentAt = useRef<number | null>(null);

  // send the latest code now, if it differs from what the server already has
  const flush = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    firstUnsentAt.current = null;
    const { language: lang, code: text } = latest.current;
    if (lastSent.current?.language === lang && lastSent.current.code === text) return;
    const next = version.current + 1;
    if (
      !send({
        type: "code.snapshot",
        version: next,
        timestamp: Date.now(),
        language: lang,
        code: text,
      })
    )
      return;
    version.current = next;
    lastSent.current = { language: lang, code: text };
  }, [send]);

  // a new interview starts counting versions from scratch
  useEffect(() => {
    version.current = 0;
    lastSent.current = null;
  }, [sessionId]);

  // after every join (the first one, or a reconnect): send what's in the editor right now,
  // including anything typed before the interview started
  useEffect(() => {
    if (joinCount === 0) return;
    lastSent.current = null;
    flush();
  }, [joinCount, flush]);

  // debounce edits: restart the wait on every change, capped so a long burst still syncs
  useEffect(() => {
    latest.current = { language, code };
    if (sock.status !== "live") return;
    const now = Date.now();
    firstUnsentAt.current ??= now;
    const wait = Math.min(DEBOUNCE_MS, MAX_WAIT_MS - (now - firstUnsentAt.current));
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, Math.max(0, wait));
  }, [language, code, flush, sock.status]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return { status: sock.status, ackedVersion: sock.ackedVersion };
}
