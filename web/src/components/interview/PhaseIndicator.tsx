import type { InterviewPhase } from "@rehearse/shared";
import { CheckIcon } from "@/components/ui/icons";

type Props = {
  phases: { id: InterviewPhase; label: string }[];
  current: InterviewPhase;
};

export function PhaseIndicator({ phases, current }: Props) {
  const currentIndex = phases.findIndex((p) => p.id === current);

  return (
    <nav aria-label="Interview phase">
      <ol className="flex flex-wrap items-center justify-center gap-2.5">
        {phases.map((phase, i) => {
          const done = i < currentIndex;
          const active = i === currentIndex;
          return (
            <li
              key={phase.id}
              aria-current={active ? "step" : undefined}
              className="flex items-center gap-2.5"
            >
              {i > 0 && <span aria-hidden="true" className="h-px w-5 bg-line-strong" />}
              <span
                className={`flex items-center gap-2 text-[13px] ${
                  active ? "font-medium text-fg" : done ? "text-accent" : "text-muted"
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${
                    active
                      ? "bg-accent font-semibold text-on-accent"
                      : done
                        ? "border border-accent"
                        : "border border-step"
                  }`}
                >
                  {done ? <CheckIcon className="h-3 w-3" /> : i + 1}
                </span>
                {phase.label}
                {done && <span className="sr-only">(done)</span>}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
