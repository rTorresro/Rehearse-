import type { SVGProps } from "react";

// tiny inline set so we don't pull in an icon lib for a dozen glyphs.
// always decorative; the button around it carries the label
function Icon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    />
  );
}

type P = SVGProps<SVGSVGElement>;

export const CheckIcon = (p: P) => (
  <Icon strokeWidth={3} {...p}>
    <path d="M5 12l5 5L20 7" />
  </Icon>
);

export const XIcon = (p: P) => (
  <Icon strokeWidth={3} {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Icon>
);

export const LockIcon = (p: P) => (
  <Icon {...p}>
    <rect x="5" y="11" width="14" height="9" rx="2" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </Icon>
);

export const MicIcon = (p: P) => (
  <Icon {...p}>
    <rect x="9" y="3" width="6" height="12" rx="3" />
    <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
  </Icon>
);

export const MicOffIcon = (p: P) => (
  <Icon {...p}>
    <path d="M3 3l18 18" />
    <path d="M9 9v2a3 3 0 0 0 5.1 2.1M15 9.3V6a3 3 0 0 0-5.7-1.3" />
    <path d="M5 11a7 7 0 0 0 11.2 5.6M19 11a7 7 0 0 1-.6 2.8M12 18v3" />
  </Icon>
);

// filled, matches the mock's Run button
export const PlayFilledIcon = (p: P) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false" {...p}>
    <path d="M7 4.5v15l13-7.5z" />
  </svg>
);

export const ClockIcon = (p: P) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </Icon>
);

export const EyeIcon = (p: P) => (
  <Icon {...p}>
    <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z" />
    <circle cx="12" cy="12" r="3" />
  </Icon>
);

export const CaptionsIcon = (p: P) => (
  <Icon {...p}>
    <rect x="3" y="5" width="18" height="14" rx="3" />
    <path d="M7 11h4M7 15h2M13 15h4" />
  </Icon>
);

export const WarningIcon = (p: P) => (
  <Icon strokeWidth={2.4} {...p}>
    <path d="M12 4l9 16H3z" />
    <path d="M12 10v4M12 17.5v.5" />
  </Icon>
);

export const RefreshIcon = (p: P) => (
  <Icon strokeWidth={2.4} {...p}>
    <path d="M3 12a9 9 0 0 1 15.5-6.2L21 8" />
    <path d="M21 3v5h-5" />
    <path d="M21 12a9 9 0 0 1-15.5 6.2L3 16" />
    <path d="M3 21v-5h5" />
  </Icon>
);

export const ChevronLeftIcon = (p: P) => (
  <Icon {...p}>
    <path d="m15 18-6-6 6-6" />
  </Icon>
);

export const ChevronRightIcon = (p: P) => (
  <Icon {...p}>
    <path d="m9 18 6-6-6-6" />
  </Icon>
);
