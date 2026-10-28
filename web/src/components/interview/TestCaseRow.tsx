import { CheckIcon, LockIcon, XIcon } from "@/components/ui/icons";
import type { RowStatus, TestRow } from "@/lib/testDisplay";

const STATUS: Record<RowStatus, { label: string; tone: "success" | "danger" | "muted" }> = {
  passed: { label: "Passed", tone: "success" },
  failed: { label: "Failed", tone: "danger" },
  compile_error: { label: "Compile error", tone: "danger" },
  runtime_error: { label: "Runtime error", tone: "danger" },
  time_limit: { label: "Time limit", tone: "danger" },
  memory_limit: { label: "Memory limit", tone: "danger" },
  output_limit: { label: "Output limit", tone: "danger" },
  internal_error: { label: "Runner error", tone: "muted" },
  pending: { label: "Not run", tone: "muted" },
  running: { label: "Running", tone: "muted" },
};

const TONE = { success: "text-success", danger: "text-danger", muted: "text-muted" } as const;

export function TestCaseRow({ row }: { row: TestRow }) {
  const s = STATUS[row.status];
  // details only for visible cases that didn't pass; hidden cases never have any
  // compile errors are the same for every case, so they're shown once in the Console instead
  const showDetails = !row.hidden && !["passed", "running", "compile_error"].includes(row.status);

  return (
    <li
      className={`flex flex-col gap-2.5 rounded-lg border bg-surface-1 px-3 py-2.5 ${
        s.tone === "danger" ? "border-danger-border" : "border-line"
      }`}
    >
      <div className="flex items-center gap-3">
        <span
          className={`flex w-[104px] shrink-0 items-center gap-1.5 text-[12.5px] font-medium ${TONE[s.tone]}`}
        >
          {row.status === "passed" && <CheckIcon className="h-3.5 w-3.5 shrink-0" />}
          {s.tone === "danger" && <XIcon className="h-3.5 w-3.5 shrink-0" />}
          {s.tone === "muted" && (
            <span
              aria-hidden="true"
              className="h-2 w-2 shrink-0 rounded-full border border-muted"
            />
          )}
          {s.label}
        </span>
        <span className="shrink-0 text-[13px]">{row.label}</span>
        {row.hidden ? (
          <span className="flex min-w-0 items-center gap-1.5 text-[12.5px] text-muted">
            <LockIcon className="h-3 w-3 shrink-0" />
            Input hidden
          </span>
        ) : (
          <span className="min-w-0 truncate font-mono text-[12.5px] text-muted">{row.input}</span>
        )}
        {typeof row.runtimeMs === "number" && (
          <span className="ml-auto shrink-0 font-mono text-xs text-muted">{row.runtimeMs} ms</span>
        )}
      </div>
      {showDetails && (
        // lines up under the label, past the status column
        <dl className="flex flex-wrap gap-x-6 gap-y-2.5 pl-[116px] font-mono text-[12.5px]">
          <div className="flex min-w-0 gap-[1ch]">
            <dt className="text-muted">Expected</dt>
            <dd className="break-all text-fg">{row.expected}</dd>
          </div>
          {row.actual !== undefined && (
            <div className="flex min-w-0 gap-[1ch]">
              <dt className="text-muted">Actual</dt>
              <dd className="break-all text-danger">{row.actual}</dd>
            </div>
          )}
          {row.error && row.status !== "failed" && (
            <div className="flex w-full min-w-0 gap-[1ch]">
              <dt className="text-muted">Error</dt>
              <dd className="line-clamp-3 break-all whitespace-pre-wrap text-danger">
                {row.error}
              </dd>
            </div>
          )}
        </dl>
      )}
    </li>
  );
}
