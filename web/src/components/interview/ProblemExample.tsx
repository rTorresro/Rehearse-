import type { ProblemExample as Example } from "@rehearse/shared";

export function ProblemExample({ example, index }: { example: Example; index: number }) {
  return (
    <>
      <h3 className="text-[13px] font-semibold">Example {index + 1}</h3>
      <div className="rounded-lg border border-line bg-surface-2 px-3.5 py-3 font-mono text-[12.5px] leading-[1.7] text-fg-2">
        <div>
          <span className="text-muted">Input:</span> {example.input}
        </div>
        <div>
          <span className="text-muted">Output:</span> {example.output}
        </div>
        {example.explanation && (
          <div className="font-sans">
            <span className="text-muted">Why:</span> {example.explanation}
          </div>
        )}
      </div>
    </>
  );
}
