"use client";

import { useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import type { TestRow } from "@/lib/testDisplay";
import { TestCaseRow } from "./TestCaseRow";

type Tab = "results" | "console";
const TABS: { id: Tab; label: string }[] = [
  { id: "results", label: "Test results" },
  { id: "console", label: "Console" },
];

type Props = {
  rows: TestRow[];
  consoleLines: string[];
  // the verdict line on the right of the tab bar
  summary: ReactNode;
  // shown above the rows, e.g. "didn't compile, see the Console"
  notice?: ReactNode;
};

export function TestResults({ rows, consoleLines, summary, notice }: Props) {
  const [tab, setTab] = useState<Tab>("results");
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // arrow keys move between tabs, per the ARIA tabs pattern
  function onKeyDown(e: KeyboardEvent) {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    const next = (TABS.findIndex((t) => t.id === tab) + 1) % TABS.length;
    setTab(TABS[next]!.id);
    tabRefs.current[next]?.focus();
  }

  return (
    <div className="flex flex-col bg-surface-2 xl:min-h-[180px] xl:flex-[2_1_0]">
      <div className="flex items-center justify-between gap-3 border-b border-line px-4">
        <div role="tablist" aria-label="Output" className="flex gap-5" onKeyDown={onKeyDown}>
          {TABS.map((t, i) => {
            const selected = tab === t.id;
            return (
              <button
                key={t.id}
                ref={(el) => {
                  tabRefs.current[i] = el;
                }}
                type="button"
                role="tab"
                id={`tab-${t.id}`}
                aria-selected={selected}
                aria-controls={`panel-${t.id}`}
                tabIndex={selected ? 0 : -1}
                onClick={() => setTab(t.id)}
                className={`border-b-2 pt-3 pb-2.5 text-[13px] ${
                  selected ? "border-accent font-semibold text-fg" : "border-transparent text-muted"
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>
        <p role="status" className="text-right text-[12.5px] text-fg-2">
          {summary}
        </p>
      </div>

      <div
        role="tabpanel"
        id={`panel-${tab}`}
        aria-labelledby={`tab-${tab}`}
        className="px-4 pt-3.5 pb-[18px] xl:min-h-0 xl:overflow-y-auto"
      >
        {tab === "results" ? (
          <>
            {notice && (
              <p className="mb-2.5 rounded-lg border border-danger-border bg-surface-1 px-3 py-2.5 text-[13px] text-fg-2">
                {notice}
              </p>
            )}
            <ul className="flex flex-col gap-2">
              {rows.map((row) => (
                <TestCaseRow key={row.key} row={row} />
              ))}
            </ul>
          </>
        ) : (
          <pre className="font-mono text-[12.5px] leading-[1.7] whitespace-pre-wrap text-fg-2">
            {consoleLines.length === 0 ? (
              <span className="text-muted">Run your code to see its output here.</span>
            ) : (
              consoleLines.map((line, i) => (
                <div
                  key={i}
                  className={
                    /^(Case \d+ (printed|error):|Compilation failed:)$/.test(line)
                      ? "text-muted"
                      : undefined
                  }
                >
                  {line || " "}
                </div>
              ))
            )}
          </pre>
        )}
      </div>
    </div>
  );
}
