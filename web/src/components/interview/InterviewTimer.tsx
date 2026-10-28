"use client";

import { useEffect, useState } from "react";
import { ClockIcon } from "@/components/ui/icons";
import { formatClock } from "@/lib/format";

export function InterviewTimer({ startAt = 0 }: { startAt?: number }) {
  const [seconds, setSeconds] = useState(startAt);

  useEffect(() => {
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex items-center gap-2">
      <ClockIcon className="h-4 w-4 text-muted" />
      {/* role=timer is implicitly aria-live off, so screen readers aren't spammed every second */}
      <span
        role="timer"
        aria-label="Time elapsed"
        className="font-mono text-sm text-fg tabular-nums"
      >
        {formatClock(seconds)}
      </span>
    </div>
  );
}
