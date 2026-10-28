import type { Language, RunRequest, RunResponse } from "@rehearse/shared";
import { SERVER_URL } from "@/lib/config";

// the server picks the test cases; we only send what to run and how
export async function runCode(req: {
  problemId: string;
  language: Language;
  code: string;
  mode: RunRequest["mode"];
  sessionId?: string;
}): Promise<RunResponse> {
  const body: RunRequest = req;
  let res: Response;
  try {
    res = await fetch(`${SERVER_URL}/api/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error("Couldn't reach the server. Check your connection and try again.");
  }
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(err?.error ?? `Run failed (${res.status})`);
  }
  return (await res.json()) as RunResponse;
}
