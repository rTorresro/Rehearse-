"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { CaptionsIcon, MicOffIcon } from "@/components/ui/icons";
import { SectionLabel } from "@/components/ui/SectionLabel";
import type { InterviewerState } from "@/lib/voice/types";
import { useVoice } from "@/lib/voice/VoiceSessionProvider";
import { useSpaceToTalk } from "@/lib/useSpaceToTalk";
import { InterviewerStatus } from "./InterviewerStatus";
import { MicButton } from "./MicButton";
import { RoundToggle } from "./RoundToggle";
import { SessionNotice } from "./SessionNotice";
import { Transcript } from "./Transcript";
import { VoiceOrb } from "./VoiceOrb";

const MIC_HINTS: Record<InterviewerState, string> = {
  idle: "Hold Space to talk",
  speaking: "Hold Space to interrupt",
  listening: "Release Space to send",
  thinking: "Hold Space to talk",
};

const PRE_LIVE_LABELS = {
  idle: "Ready when you are",
  "mic-prompt": "Allow microphone access to continue",
  connecting: "Connecting...",
  ended: "Interview ended",
  error: "Not connected",
} as const;

export function InterviewerPanel() {
  const voice = useVoice();
  const [captionsOn, setCaptionsOn] = useState(true);
  const live = voice.status === "live";
  // the hook ignores this while muted or not connected, so no guards needed here
  useSpaceToTalk(voice.setTalking);

  return (
    <section
      aria-label="Interviewer"
      className="flex min-w-0 flex-col border-t border-line bg-surface-1 xl:max-w-[440px] xl:min-h-0 xl:flex-[1_1_340px] xl:border-t-0 xl:border-l"
    >
      <div className="flex flex-col items-center gap-3.5 px-6 pt-5 pb-2">
        <SectionLabel className="self-start">Interviewer</SectionLabel>
        <VoiceOrb state={live ? voice.state : "idle"} />
        <InterviewerStatus
          state={voice.state}
          label={live ? undefined : PRE_LIVE_LABELS[voice.status as keyof typeof PRE_LIVE_LABELS]}
        />
      </div>

      <Transcript
        lines={voice.lines}
        pendingCandidate={voice.holding}
        captionsOn={captionsOn}
        emptyText={
          live
            ? "The interviewer is about to start."
            : "Start the interview and the interviewer will introduce the problem."
        }
      />

      <div className="flex flex-col items-center gap-3 border-t border-line px-6 pt-4 pb-5">
        {voice.error ? (
          <SessionNotice error={voice.error} onRetry={voice.start} />
        ) : live ? (
          <>
            <div className="flex items-center justify-center gap-5">
              <RoundToggle
                label="Mute microphone"
                pressed={voice.muted}
                onToggle={() => voice.setMuted(!voice.muted)}
                changed={voice.muted}
                changedClass="border-danger-border bg-surface-3 text-danger-text"
              >
                <MicOffIcon className="h-[18px] w-[18px]" />
              </RoundToggle>
              <MicButton state={voice.state} disabled={voice.muted} onHold={voice.setTalking} />
              <RoundToggle
                label="Show captions"
                pressed={captionsOn}
                onToggle={() => setCaptionsOn((v) => !v)}
                changed={!captionsOn}
                changedClass="border-line bg-transparent text-muted"
              >
                <CaptionsIcon className="h-[18px] w-[18px]" />
              </RoundToggle>
            </div>
            <p className="text-[12.5px] text-muted">
              {voice.muted ? "Microphone is muted" : MIC_HINTS[voice.state]}
            </p>
          </>
        ) : (
          <>
            <Button
              variant="primary"
              size="lg"
              pad="wide"
              onClick={voice.start}
              disabled={voice.status === "connecting" || voice.status === "mic-prompt"}
            >
              {voice.status === "mic-prompt"
                ? "Waiting for microphone..."
                : voice.status === "connecting"
                  ? "Connecting..."
                  : voice.status === "ended"
                    ? "Start a new interview"
                    : "Start interview"}
            </Button>
            <p className="text-[12.5px] text-muted">
              Your browser will ask to use your microphone.
            </p>
          </>
        )}
      </div>
    </section>
  );
}
