import type { KeyMoment } from "@rehearse/shared";
import { CheckIcon, WarningIcon } from "@/components/ui/icons";
import { Tag } from "@/components/ui/Tag";

// icon + word + color, so it still reads in grayscale or for colorblind folks
export function MomentTag({ kind }: { kind: KeyMoment["kind"] }) {
  return kind === "strength" ? (
    <Tag tone="success" icon={<CheckIcon className="h-3 w-3" />}>
      Strength
    </Tag>
  ) : (
    <Tag tone="warn" icon={<WarningIcon className="h-3 w-3" />}>
      Needs work
    </Tag>
  );
}
