import type { ReactNode } from "react";

type Props = {
  label: string;
  pressed: boolean;
  onToggle: () => void;
  // how this toggle looks when it's in its "changed" state, e.g. mic muted or captions off
  changed: boolean;
  changedClass: string;
  children: ReactNode;
};

// the 44px side buttons next to the mic. toggle pattern: fixed label, aria-pressed for state
export function RoundToggle({ label, pressed, onToggle, changed, changedClass, children }: Props) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      onClick={onToggle}
      className={`flex h-11 w-11 items-center justify-center rounded-full border transition-colors ${
        changed ? changedClass : "border-line-strong bg-surface-3 text-fg-2 hover:text-fg"
      }`}
    >
      {children}
    </button>
  );
}
