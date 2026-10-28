import type { ReportCategory } from "@rehearse/shared";
import { Card } from "@/components/ui/Card";
import { ScoreBar } from "./ScoreBar";

export function CategoryCard({ category }: { category: ReportCategory }) {
  return (
    <Card
      as="section"
      label={category.label}
      className="flex flex-[1_1_260px] flex-col gap-3.5 px-[22px] pt-[22px] pb-6"
    >
      <div className="flex items-baseline justify-between">
        <h2 className="text-[15px] font-semibold">{category.label}</h2>
        <span className="font-mono text-xl">
          {category.score}
          <span className="sr-only"> out of 100</span>
        </span>
      </div>
      <ScoreBar score={category.score} label={category.label} />
      <p className="text-[13.5px] leading-[1.6] text-fg-2">{category.feedback}</p>
    </Card>
  );
}
