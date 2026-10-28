"use client";

import Editor, { type BeforeMount, type OnMount } from "@monaco-editor/react";
import { useEffect, useRef } from "react";
import type { Language } from "@rehearse/shared";
import { defineRehearseTheme, monoFontFamily, THEME_NAME } from "@/lib/code/monacoTheme";

type Props = {
  language: Language;
  // one model per path, so each language keeps its own text and undo history
  path: string;
  defaultValue: string;
  tabSize: number;
  label: string;
  onChange: (code: string) => void;
  onCursor: (line: number, col: number) => void;
  // Ctrl/Cmd+Enter
  onRunShortcut: () => void;
};

// our Language ids happen to match Monaco's, but keep the mapping explicit
const MONACO_LANGUAGE: Record<Language, string> = {
  python: "python",
  javascript: "javascript",
  java: "java",
  cpp: "cpp",
};

export function CodeEditor({
  language,
  path,
  defaultValue,
  tabSize,
  label,
  onChange,
  onCursor,
  onRunShortcut,
}: Props) {
  // Monaco keeps the command it was given at mount, so route it through a ref to stay current
  const runRef = useRef(onRunShortcut);
  useEffect(() => {
    runRef.current = onRunShortcut;
  }, [onRunShortcut]);

  const beforeMount: BeforeMount = (monaco) => defineRehearseTheme(monaco);

  const onMount: OnMount = (editor, monaco) => {
    editor.onDidChangeCursorPosition((e) => onCursor(e.position.lineNumber, e.position.column));
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => runRef.current());
    const pos = editor.getPosition();
    if (pos) onCursor(pos.lineNumber, pos.column);
    // set here, not in options: mount only runs in the browser, rendering also runs on the server
    editor.updateOptions({ fontFamily: monoFontFamily() });
    // next/font may finish loading after Monaco measured the fallback font
    void document.fonts?.ready.then(() => monaco.editor.remeasureFonts());
  };

  const reducedMotion =
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  return (
    <Editor
      path={path}
      language={MONACO_LANGUAGE[language]}
      defaultValue={defaultValue}
      theme={THEME_NAME}
      beforeMount={beforeMount}
      onMount={onMount}
      onChange={(value) => onChange(value ?? "")}
      loading={<p className="p-4 text-[13px] text-muted">Loading editor...</p>}
      options={{
        ariaLabel: `${label} code editor. Press Alt+F1 for accessibility options, Ctrl+M to let Tab move focus.`,
        fontSize: 13.5,
        lineHeight: 22,
        // ligatures turn >= into a glyph people didn't type
        fontLigatures: false,
        tabSize,
        insertSpaces: true,
        detectIndentation: false,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        padding: { top: 14, bottom: 14 },
        lineNumbersMinChars: 3,
        renderLineHighlight: "line",
        // rainbow brackets fight the one-accent palette
        bracketPairColorization: { enabled: false },
        guides: { bracketPairs: false },
        overviewRulerLanes: 0,
        hideCursorInOverviewRuler: true,
        scrollbar: { verticalScrollbarSize: 10, horizontalScrollbarSize: 10 },
        automaticLayout: true,
        cursorBlinking: reducedMotion ? "solid" : "blink",
        smoothScrolling: !reducedMotion,
        // the interviewer judges what they type, so no autocomplete doing the work for them
        quickSuggestions: false,
        suggestOnTriggerCharacters: false,
        wordBasedSuggestions: "off",
        parameterHints: { enabled: false },
      }}
    />
  );
}
