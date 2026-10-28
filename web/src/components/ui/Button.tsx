import Link from "next/link";
import type { ButtonHTMLAttributes, ComponentProps } from "react";

type Variant = "primary" | "secondary" | "outline" | "accent-outline" | "danger";
type Size = "sm" | "md" | "lg";

type Pad = "tight" | "normal" | "wide";

// pad nudges horizontal padding a notch either way; the mocks vary it per button
type StyleProps = { variant?: Variant; size?: Size; pad?: Pad };

const VARIANTS: Record<Variant, string> = {
  primary: "bg-accent font-semibold text-on-accent hover:brightness-110",
  secondary: "border border-line-strong bg-surface-3 font-medium text-fg hover:bg-line",
  outline: "border border-line-strong text-fg hover:bg-surface-3",
  "accent-outline": "border border-accent text-accent hover:bg-accent-soft",
  danger: "border border-danger-border font-medium text-danger-text hover:bg-danger-border/40",
};

const SIZES: Record<Size, { base: string } & Record<Pad, string>> = {
  sm: {
    base: "gap-1.5 rounded-md py-1.5 text-[12.5px]",
    tight: "px-2.5",
    normal: "px-3",
    wide: "px-3.5",
  },
  md: {
    base: "gap-2 rounded-lg py-2 text-[13px]",
    tight: "px-3.5",
    normal: "px-4",
    wide: "px-[18px]",
  },
  lg: {
    base: "gap-2 rounded-lg py-2.5 text-[13px]",
    tight: "px-4",
    normal: "px-[18px]",
    wide: "px-5",
  },
};

function classes({ variant = "secondary", size = "md", pad = "normal" }: StyleProps, extra = "") {
  const s = SIZES[size];
  return `inline-flex items-center justify-center whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTS[variant]} ${s.base} ${s[pad]} ${extra}`;
}

export function Button({
  variant,
  size,
  pad,
  className,
  type = "button",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & StyleProps) {
  return <button type={type} className={classes({ variant, size, pad }, className)} {...rest} />;
}

// same look, but navigates. a link that looks like a button is still a link to AT, which is right
export function ButtonLink({
  variant,
  size,
  pad,
  className,
  ...rest
}: ComponentProps<typeof Link> & StyleProps) {
  return <Link className={classes({ variant, size, pad }, className)} {...rest} />;
}
