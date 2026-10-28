"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { endInterview } from "@/lib/reportApi";
import { useVoice } from "@/lib/voice/VoiceSessionProvider";

// ends the interview on the server (which starts the feedback report), hangs up, and goes
// to the report
export function EndInterviewButton() {
  const voice = useVoice();
  const router = useRouter();
  const [ending, setEnding] = useState(false);

  async function end() {
    // grab it first: hanging up clears it
    const id = voice.sessionId;
    setEnding(true);
    try {
      if (id) await endInterview(id);
    } catch {
      // the call dropping ends it on the server too, so the report still gets written
    }
    voice.end();
    if (id) router.push(`/report/${id}`);
    else setEnding(false);
  }

  return (
    <Button variant="danger" pad="tight" onClick={end} disabled={voice.status !== "live" || ending}>
      {ending ? "Ending..." : "End interview"}
    </Button>
  );
}
