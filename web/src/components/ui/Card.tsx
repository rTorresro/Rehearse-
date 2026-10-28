import type { ReactNode } from "react";

type Props = {
  as?: "section" | "article" | "div" | "li";
  // sections need a name to show up as landmarks
  label?: string;
  // 14px for the big report cards, 12px for list rows
  radius?: "md" | "lg";
  // warn is for "needs work" rows in the report
  border?: "default" | "warn";
  className?: string;
  children: ReactNode;
};

export function Card({
  as: Tag = "div",
  label,
  radius = "lg",
  border = "default",
  className = "",
  children,
}: Props) {
  const radiusClass = radius === "lg" ? "rounded-[14px]" : "rounded-xl";
  const borderClass = border === "warn" ? "border-warn-border" : "border-line";
  return (
    <Tag
      aria-label={label}
      className={`border bg-surface-2 ${radiusClass} ${borderClass} ${className}`}
    >
      {children}
    </Tag>
  );
}
