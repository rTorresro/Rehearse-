import type { EndInterviewResponse, ReportHistory, ReportStatusResponse } from "@rehearse/shared";
import { SERVER_URL } from "@/lib/config";

export async function endInterview(sessionId: string): Promise<EndInterviewResponse> {
  const res = await fetch(`${SERVER_URL}/api/realtime/session/${sessionId}/end`, {
    method: "POST",
  });
  if (!res.ok) throw new Error(`end failed (${res.status})`);
  return (await res.json()) as EndInterviewResponse;
}

// null when the server has never heard of this report
export async function fetchReport(id: string): Promise<ReportStatusResponse | null> {
  const res = await fetch(`${SERVER_URL}/api/reports/${encodeURIComponent(id)}`, {
    cache: "no-store",
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`report fetch failed (${res.status})`);
  return (await res.json()) as ReportStatusResponse;
}

export async function retryReport(id: string) {
  await fetch(`${SERVER_URL}/api/reports/${encodeURIComponent(id)}/retry`, { method: "POST" });
}

export async function fetchHistory(id: string): Promise<ReportHistory> {
  const res = await fetch(`${SERVER_URL}/api/reports/${encodeURIComponent(id)}/history`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`history fetch failed (${res.status})`);
  return (await res.json()) as ReportHistory;
}
