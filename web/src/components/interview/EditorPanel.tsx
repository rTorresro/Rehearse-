"use client";

import { useMemo, useState } from "react";
import type { Language, PublicProblem, RunRequest, RunResponse } from "@rehearse/shared";
import { runCode } from "@/lib/code/runCode";
import { EyeIcon } from "@/components/ui/icons";
import { useCodeSync } from "@/lib/code/useCodeSync";
import type { SocketStatus as CodeSyncStatus } from "@/lib/interview/InterviewSocketProvider";
import { LANGUAGE_OPTIONS } from "@/lib/languages";
import { consoleLines, idleRows, resultRows, VERDICT_LABEL } from "@/lib/testDisplay";
import { useVoice } from "@/lib/voice/VoiceSessionProvider";
import { CodeEditor } from "./CodeEditor";
import { LanguageSelect } from "./LanguageSelect";
import { RunBar } from "./RunBar";
import { TestResults } from "./TestResults";

// matches the starter code's indentation
const TAB_SIZE: Record<Language, number> = { python: 4, javascript: 2, java: 4, cpp: 4 };

const SYNC_LABEL: Record<CodeSyncStatus, string> = {
  off: "Interviewer sees your code once the interview starts",
  connecting: "Sharing your code with the interviewer...",
  live: "Interviewer can see your code",
  reconnecting: "Reconnecting code sharing...",
};

export function EditorPanel({ problem }: { problem: PublicProblem }) {
  const voice = useVoice();
  const [language, setLanguage] = useState<Language>("python");
  // one buffer per language, starting from the starter code, so switching back keeps your work
  const [code, setCode] = useState<Record<Language, string>>(() => ({ ...problem.starterCode }));
  const [cursor, setCursor] = useState({ line: 1, col: 1 });
  const option = LANGUAGE_OPTIONS.find((l) => l.id === language)!;

  const sync = useCodeSync({ language, code: code[language] });

  const [busy, setBusy] = useState<RunRequest["mode"] | null>(null);
  const [result, setResult] = useState<RunResponse | null>(null);
  const [runError, setRunError] = useState<string | null>(null);

  async function execute(mode: RunRequest["mode"]) {
    if (busy) return;
    setBusy(mode);
    setRunError(null);
    try {
      setResult(
        await runCode({
          problemId: problem.id,
          language,
          code: code[language],
          mode,
          // lets the server tell the interviewer how the run went
          sessionId: voice.sessionId ?? undefined,
        }),
      );
    } catch (err) {
      setRunError((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const rows = useMemo(() => {
    // while a run is going, show the visible cases as running rather than stale results
    if (busy) return idleRows(problem.signature, problem.visibleTests, "running");
    if (result) return resultRows(result);
    return idleRows(problem.signature, problem.visibleTests, "pending");
  }, [busy, result, problem.signature, problem.visibleTests]);

  const summary = busy ? (
    busy === "run" ? (
      "Running the visible cases..."
    ) : (
      "Running every case, hidden ones included..."
    )
  ) : runError ? (
    <span className="text-danger">{runError}</span>
  ) : result ? (
    <>
      <span className={result.verdict === "accepted" ? "text-success" : "text-danger"}>
        {result.mode === "submit" ? "Submitted: " : ""}
        {VERDICT_LABEL[result.verdict]}
      </span>{" "}
      · {result.passed}/{result.total} passed
    </>
  ) : (
    `${problem.visibleTests.length} cases · not run yet`
  );

  return (
    <section
      aria-label="Code editor"
      className="flex min-w-0 flex-col bg-bg xl:min-h-0 xl:flex-[3_1_520px] xl:overflow-hidden"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-line bg-surface-1 px-4 py-2.5">
        <div className="flex items-center gap-3">
          <span className="rounded-md bg-surface-3 px-3 py-[5px] font-mono text-[12.5px] text-fg">
            {option.fileName}
          </span>
          <LanguageSelect value={language} options={LANGUAGE_OPTIONS} onChange={setLanguage} />
        </div>
        <p role="status" className="flex items-center gap-2 text-[12.5px] text-muted">
          <EyeIcon
            className={`h-[15px] w-[15px] ${sync.status === "live" ? "text-accent" : "text-muted"}`}
          />
          {SYNC_LABEL[sync.status]}
        </p>
      </div>
      <div className="h-[420px] shrink-0 bg-surface-1 xl:h-auto xl:min-h-[300px] xl:flex-[3_1_0]">
        <CodeEditor
          language={language}
          path={`${problem.id}/${option.fileName}`}
          defaultValue={problem.starterCode[language]}
          tabSize={TAB_SIZE[language]}
          label={option.label}
          onChange={(text) => setCode((prev) => ({ ...prev, [language]: text }))}
          onCursor={(line, col) => setCursor({ line, col })}
          onRunShortcut={() => void execute("run")}
        />
      </div>
      <RunBar
        status={`Ln ${cursor.line}, Col ${cursor.col} · Spaces: ${TAB_SIZE[language]} · UTF-8`}
        busy={busy}
        onRun={() => void execute("run")}
        onSubmit={() => void execute("submit")}
      />
      <TestResults
        rows={rows}
        consoleLines={consoleLines(result)}
        summary={summary}
        notice={
          !busy && result?.compileError
            ? "Your code didn't compile, so no cases ran. The compiler output is in the Console tab."
            : undefined
        }
      />
    </section>
  );
}
