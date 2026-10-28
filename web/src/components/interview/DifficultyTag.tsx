import type { Difficulty } from "@rehearse/shared";
import { Tag } from "@/components/ui/Tag";

// the word carries the meaning, the color just backs it up
const TONE = { easy: "success", medium: "warn", hard: "danger" } as const;

export function DifficultyTag({ difficulty }: { difficulty: Difficulty }) {
  return (
    <Tag tone={TONE[difficulty]}>
      <span className="capitalize">{difficulty}</span>
    </Tag>
  );
}
