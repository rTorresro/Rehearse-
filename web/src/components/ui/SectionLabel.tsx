import type { ReactNode } from "react";

// the small uppercase label the spec puts above panels and titles
export function SectionLabel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`text-xs font-medium tracking-[0.06em] text-muted uppercase ${className}`}>
      {children}
    </div>
  );
}
