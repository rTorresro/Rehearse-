"use client";

import { useEffect, useState } from "react";
import type { HealthResponse } from "@rehearse/shared";
import { SERVER_URL } from "@/lib/config";

type Status = "checking" | "up" | "down";

// quick sanity check that the two apps can actually talk
export function ServerStatus() {
  const [status, setStatus] = useState<Status>("checking");

  useEffect(() => {
    fetch(`${SERVER_URL}/health`)
      .then((res) => res.json() as Promise<HealthResponse>)
      .then((body) => setStatus(body.ok ? "up" : "down"))
      .catch(() => setStatus("down"));
  }, []);

  const color = { checking: "bg-zinc-500", up: "bg-emerald-500", down: "bg-red-500" }[status];

  return (
    <p className="flex items-center gap-2 text-sm text-muted">
      <span className={`h-2 w-2 rounded-full ${color}`} />
      server {status}
    </p>
  );
}
