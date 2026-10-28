import type { KeyMoment } from "@rehearse/shared";
import { MomentItem } from "./MomentItem";

export function MomentsTimeline({ moments }: { moments: KeyMoment[] }) {
  return (
    <section aria-labelledby="moments-heading" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="moments-heading" className="text-lg font-semibold tracking-[-0.01em]">
          Key moments
        </h2>
        <p className="text-[13px] text-muted">
          Each moment links to the transcript or a snapshot of your code at that point.
        </p>
      </div>
      <ol className="flex flex-col gap-2.5">
        {moments.map((m) => (
          <MomentItem key={m.id} moment={m} />
        ))}
      </ol>
    </section>
  );
}
