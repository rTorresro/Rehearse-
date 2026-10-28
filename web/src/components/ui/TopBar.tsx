import type { ReactNode } from "react";
import { Logo } from "./Logo";

type Props = {
  // middle slot, e.g. the phase indicator. wraps onto its own row when space runs out
  children?: ReactNode;
  actions?: ReactNode;
};

export function TopBar({ children, actions }: Props) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b border-line bg-surface-1 px-6 py-3">
      <Logo />
      {children && <div className="flex flex-[1_1_520px] justify-center">{children}</div>}
      {actions && <div className="flex shrink-0 items-center gap-4">{actions}</div>}
    </header>
  );
}
