"use client";

import { DiffEditor, type DiffBeforeMount, type DiffOnMount } from "@monaco-editor/react";
import { useState } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/ui/icons";
import { Dialog } from "@/components/ui/Dialog";
import { defineRehearseTheme, monoFontFamily, THEME_NAME } from "@/lib/code/monacoTheme";
import { formatClock } from "@/lib/format";
import { LANGUAGE_OPTIONS } from "@/lib/languages";
import { HistoryStatus } from "./HistoryStatus";
import type { HistoryState, ViewTarget } from "./ReportViewerProvider";

type Props = {
  target: (ViewTarget & { type: "code" }) | null;
  history: HistoryState;
  onRetry: () => void;
  onClose: () => void;
  onNavigate: (version: number) => void;
};

// side by side needs room; below this the diff goes inline
const SIDE_BY_SIDE_MIN = 900;

export function CodeDiffDialog({ target, history, onRetry, onClose, onNavigate }: Props) {
  const snaps = history.status === "ready" ? history.history.snapshots : [];
  const i = target ? snaps.findIndex((s) => s.version === target.version) : -1;
  const snap = i >= 0 ? snaps[i] : undefined;
  const prev = i > 0 ? snaps[i - 1] : undefined;
  // decided when the dialog opens; resizing mid-view isn't worth a re-layout
  const [sideBySide] = useState(
    () => typeof window === "undefined" || window.innerWidth >= SIDE_BY_SIDE_MIN,
  );

  const beforeMount: DiffBeforeMount = (monaco) => defineRehearseTheme(monaco);
  const onMount: DiffOnMount = (editor, monaco) => {
    const font = { fontFamily: monoFontFamily() };
    editor.getOriginalEditor().updateOptions(font);
    editor.getModifiedEditor().updateOptions(font);
    void document.fonts?.ready.then(() => monaco.editor.remeasureFonts());
  };

  const label = snap
    ? (LANGUAGE_OPTIONS.find((l) => l.id === snap.language)?.label ?? snap.language)
    : "";
  const navButton =
    "grid h-8 w-8 place-items-center rounded-lg border border-line-strong text-fg-2 hover:bg-surface-3 disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <Dialog
      variant="modal"
      open={target !== null}
      onClose={onClose}
      title={snap ? `Code v${snap.version}` : target ? `Code v${target.version}` : "Code"}
      subtitle={
        snap
          ? `${formatClock(snap.at)} · ${label} · ${prev ? `changes from v${prev.version}` : "first version, shown in full"}`
          : undefined
      }
      actions={
        snap && (
          <>
            <button
              type="button"
              aria-label="Previous version"
              className={navButton}
              disabled={!prev}
              onClick={() => prev && onNavigate(prev.version)}
            >
              <ChevronLeftIcon className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label="Next version"
              className={navButton}
              disabled={i >= snaps.length - 1}
              onClick={() => snaps[i + 1] && onNavigate(snaps[i + 1]!.version)}
            >
              <ChevronRightIcon className="h-4 w-4" />
            </button>
          </>
        )
      }
    >
      {history.status !== "ready" ? (
        <HistoryStatus state={history} onRetry={onRetry} />
      ) : !snap ? (
        <p className="p-6 text-[13px] text-muted">This version of the code wasn&apos;t saved.</p>
      ) : (
        <div className="h-full bg-surface-1" aria-label={`Code version ${snap.version}, read only`}>
          <DiffEditor
            original={prev?.code ?? ""}
            modified={snap.code}
            language={snap.language === "cpp" ? "cpp" : snap.language}
            theme={THEME_NAME}
            beforeMount={beforeMount}
            onMount={onMount}
            loading={<p className="p-6 text-[13px] text-muted">Loading code...</p>}
            options={{
              readOnly: true,
              originalEditable: false,
              renderSideBySide: sideBySide,
              fontSize: 13.5,
              lineHeight: 22,
              fontLigatures: false,
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              renderOverviewRuler: false,
              enableSplitViewResizing: false,
              ignoreTrimWhitespace: false,
              automaticLayout: true,
              padding: { top: 14, bottom: 14 },
              bracketPairColorization: { enabled: false },
              scrollbar: { verticalScrollbarSize: 10, horizontalScrollbarSize: 10 },
            }}
          />
        </div>
      )}
    </Dialog>
  );
}
