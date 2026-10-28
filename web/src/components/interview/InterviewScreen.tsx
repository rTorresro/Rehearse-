import type { PublicProblem } from "@rehearse/shared";
import { InterviewSocketProvider } from "@/lib/interview/InterviewSocketProvider";
import { VoiceSessionProvider } from "@/lib/voice/VoiceSessionProvider";
import { EditorPanel } from "./EditorPanel";
import { InterviewerPanel } from "./InterviewerPanel";
import { InterviewTopBar } from "./InterviewTopBar";
import { ProblemPanel } from "./ProblemPanel";

export function InterviewScreen({ problem }: { problem: PublicProblem }) {
  return (
    // three flush columns pinned to the viewport on wide screens, each scrolling on its own.
    // below xl they stack full width and the page scrolls
    <VoiceSessionProvider problemId={problem.id}>
      <InterviewSocketProvider>
        <div className="flex min-h-dvh flex-col bg-bg xl:h-dvh">
          <InterviewTopBar />
          <main className="flex flex-1 flex-col xl:min-h-0 xl:flex-row">
            <ProblemPanel problem={problem} />
            <EditorPanel problem={problem} />
            <InterviewerPanel />
          </main>
        </div>
      </InterviewSocketProvider>
    </VoiceSessionProvider>
  );
}
