import type { PublicProblem } from "@rehearse/shared";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { Tag } from "@/components/ui/Tag";
import { TAG_LABELS } from "@/lib/tags";
import { DifficultyTag } from "./DifficultyTag";
import { HintsCard } from "./HintsCard";
import { ProblemExample } from "./ProblemExample";
import { RichText } from "./RichText";

export function ProblemPanel({ problem }: { problem: PublicProblem }) {
  return (
    <section
      aria-label="Problem"
      className="flex min-w-0 flex-col gap-5 border-b border-line bg-surface-1 p-6 xl:max-w-[440px] xl:flex-[1_1_340px] xl:overflow-y-auto xl:border-r xl:border-b-0"
    >
      <div className="flex flex-col gap-3">
        <SectionLabel>Problem</SectionLabel>
        <h1 className="text-[22px] font-semibold tracking-[-0.015em]">{problem.title}</h1>
        <div className="flex flex-wrap gap-2">
          <DifficultyTag difficulty={problem.difficulty} />
          {problem.tags.map((t) => (
            <Tag key={t}>{TAG_LABELS[t]}</Tag>
          ))}
        </div>
      </div>

      {problem.statement.map((p) => (
        <p key={p} className="leading-[1.65] text-fg-2">
          <RichText text={p} />
        </p>
      ))}

      <div className="flex flex-col gap-2.5">
        {problem.examples.map((ex, i) => (
          <ProblemExample key={ex.input} example={ex} index={i} />
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-[13px] font-semibold">Constraints</h3>
        <ul className="flex list-disc flex-col gap-1 pl-[18px] font-mono text-[12.5px] text-fg-2">
          {problem.constraints.map((c) => (
            <li key={c}>
              <RichText text={c} />
            </li>
          ))}
        </ul>
      </div>

      <HintsCard total={problem.hintCount} />
    </section>
  );
}
