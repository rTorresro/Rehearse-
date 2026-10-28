import { TopBar } from "@/components/ui/TopBar";
import { EndInterviewButton } from "./EndInterviewButton";
import { CURRENT_PHASE, ELAPSED_SECONDS_AT_LOAD, PHASES } from "@/lib/mock-interview";
import { InterviewTimer } from "./InterviewTimer";
import { PhaseIndicator } from "./PhaseIndicator";

export function InterviewTopBar() {
  return (
    <TopBar
      actions={
        <>
          <InterviewTimer startAt={ELAPSED_SECONDS_AT_LOAD} />
          <EndInterviewButton />
        </>
      }
    >
      <PhaseIndicator phases={PHASES} current={CURRENT_PHASE} />
    </TopBar>
  );
}
