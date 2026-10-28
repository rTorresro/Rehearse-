import type { Metadata } from "next";
import { listProblems } from "@rehearse/problems";
import { ProblemPicker } from "@/components/practice/ProblemPicker";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { TopBar } from "@/components/ui/TopBar";

export const metadata: Metadata = { title: "Choose an interview · Rehearse" };

export default function PracticePage() {
  // summaries only: ids, titles, difficulty, tags. nothing that gives a problem away
  const problems = listProblems();

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <TopBar />
      <main className="mx-auto flex w-full max-w-[720px] flex-col gap-8 px-6 pt-10 pb-16">
        <div className="flex flex-col gap-2">
          <SectionLabel>Mock interview</SectionLabel>
          <h1 className="text-[30px] font-semibold tracking-[-0.02em]">Set up your interview</h1>
          <p className="leading-[1.65] text-fg-2">
            Pick a difficulty and a topic. You&apos;ll get a random problem that matches, so you go
            in cold like a real interview.
          </p>
        </div>
        <ProblemPicker problems={problems} />
        <p className="text-[13px] leading-normal text-muted">
          You&apos;ll talk the problem through out loud with the interviewer, so have a microphone
          ready. Your browser asks for permission when the interview starts.
        </p>
      </main>
    </div>
  );
}
