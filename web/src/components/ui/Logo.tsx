import Link from "next/link";

export function Logo() {
  return (
    <Link href="/" className="flex shrink-0 items-center gap-2.5 rounded-md">
      <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="10" fill="none" strokeWidth="1.5" className="stroke-accent" />
        <circle cx="12" cy="12" r="4.5" className="fill-accent" />
      </svg>
      <span className="text-[15px] font-semibold tracking-[-0.01em]">Rehearse</span>
    </Link>
  );
}
