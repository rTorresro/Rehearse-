"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import type { ReportHistory } from "@rehearse/shared";
import { getMockHistory } from "@/lib/mock-report";
import { fetchHistory } from "@/lib/reportApi";
import { CodeDiffDialog } from "./CodeDiffDialog";
import { TranscriptDrawer } from "./TranscriptDrawer";

// what a moment button asks to see
export type ViewTarget =
  | { type: "transcript"; fromLine?: number; toLine?: number; at?: number }
  | { type: "code"; version: number };

export type HistoryState =
  { status: "loading" } | { status: "ready"; history: ReportHistory } | { status: "error" };

// opener: the button that asked, so focus can go back to it on close. <dialog> does that by
// itself only when the button had focus, which Safari skips on a mouse click
type Viewer = { open: (target: ViewTarget, opener?: HTMLElement | null) => void };
const Ctx = createContext<Viewer | null>(null);

// "demo" is the built-in sample; anything else is a real interview's report
export type ReportSource = { kind: "live"; id: string } | { kind: "demo" };

// owns the transcript drawer and the code dialog for one report. the history behind them is
// fetched the first time either opens, then kept
export function ReportViewerProvider({
  source,
  children,
}: {
  source: ReportSource;
  children: ReactNode;
}) {
  const [target, setTarget] = useState<ViewTarget | null>(null);
  const [history, setHistory] = useState<HistoryState>({ status: "loading" });
  const requested = useRef(false);
  const opener = useRef<HTMLElement | null>(null);

  const load = useCallback(() => {
    requested.current = true;
    setHistory({ status: "loading" });
    if (source.kind === "demo") return setHistory({ status: "ready", history: getMockHistory() });
    fetchHistory(source.id).then(
      (h) => setHistory({ status: "ready", history: h }),
      () => setHistory({ status: "error" }),
    );
  }, [source]);

  const open = useCallback(
    (t: ViewTarget, from?: HTMLElement | null) => {
      if (!requested.current) load();
      opener.current = from ?? null;
      setTarget(t);
    },
    [load],
  );
  const close = () => {
    setTarget(null);
    // after the dialog has closed and done its own focus handling
    const el = opener.current;
    requestAnimationFrame(() => el?.focus());
  };

  return (
    <Ctx value={{ open }}>
      {children}
      <TranscriptDrawer
        target={target?.type === "transcript" ? target : null}
        history={history}
        onRetry={load}
        onClose={close}
      />
      <CodeDiffDialog
        target={target?.type === "code" ? target : null}
        history={history}
        onRetry={load}
        onClose={close}
        onNavigate={(version) => setTarget({ type: "code", version })}
      />
    </Ctx>
  );
}

export function useReportViewer() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useReportViewer needs a ReportViewerProvider above it");
  return ctx;
}
