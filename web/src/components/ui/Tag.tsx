import type { ReactNode } from "react";

type Tone = "neutral" | "success" | "warn" | "danger";

const TONES: Record<Tone, string> = {
  neutral: "bg-surface-3 text-fg-2",
  success: "bg-success-bg font-medium text-success",
  warn: "bg-warn-bg font-medium text-warn",
  danger: "bg-danger-border/50 font-medium text-danger",
};

// pass an icon whenever the tone means something, so it never relies on color alone
export function Tag({
  tone = "neutral",
  icon,
  children,
}: {
  tone?: Tone;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-[3px] text-xs ${TONES[tone]}`}
    >
      {icon}
      {children}
    </span>
  );
}
