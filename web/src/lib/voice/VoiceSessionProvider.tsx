"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useVoiceSession } from "./useVoiceSession";

type VoiceSession = ReturnType<typeof useVoiceSession>;

const VoiceSessionContext = createContext<VoiceSession | null>(null);

// one call per interview screen, shared by the top bar (End interview) and the interviewer panel
export function VoiceSessionProvider({
  problemId,
  children,
}: {
  problemId: string;
  children: ReactNode;
}) {
  const session = useVoiceSession(problemId);
  return <VoiceSessionContext value={session}>{children}</VoiceSessionContext>;
}

export function useVoice() {
  const session = useContext(VoiceSessionContext);
  if (!session) throw new Error("useVoice needs a VoiceSessionProvider above it");
  return session;
}
