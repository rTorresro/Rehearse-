import { LANGUAGES, type Language } from "@rehearse/shared";
import { env } from "../env.js";
import { Judge0Runner, JUDGE0_CE_LANGUAGE_IDS } from "./judge0.js";
import type { ExecLimits } from "./types.js";

export const execLimits: ExecLimits = {
  cpuTimeSec: env.runCpuTimeSec,
  // wall time covers startup and waiting on IO; twice the CPU budget is plenty
  wallTimeSec: env.runCpuTimeSec * 2,
  memoryKb: env.runMemoryMb * 1024,
  maxFileKb: 1024,
};

function languageIds(): Record<Language, number> {
  if (!env.judge0LanguageIds) return JUDGE0_CE_LANGUAGE_IDS;
  const overrides = JSON.parse(env.judge0LanguageIds) as Partial<Record<Language, number>>;
  for (const key of Object.keys(overrides)) {
    if (!(LANGUAGES as readonly string[]).includes(key))
      throw new Error(`JUDGE0_LANGUAGE_IDS: unknown language ${key}`);
  }
  return { ...JUDGE0_CE_LANGUAGE_IDS, ...overrides };
}

// one place decides which Judge0 we talk to and how we authenticate
export function judge0FromEnv() {
  const headers: Record<string, string> = {};
  if (env.judge0RapidApiKey) {
    headers["X-RapidAPI-Key"] = env.judge0RapidApiKey;
    headers["X-RapidAPI-Host"] = env.judge0RapidApiHost;
  }
  if (env.judge0AuthToken) headers["X-Auth-Token"] = env.judge0AuthToken;
  return new Judge0Runner({ baseUrl: env.judge0Url, headers, languageIds: languageIds() });
}
