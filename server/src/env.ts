import "dotenv/config";

// one place to read env so a missing var fails loud and early
export const env = {
  port: Number(process.env.PORT ?? 4000),
  webOrigin: process.env.WEB_ORIGIN ?? "http://localhost:3000",
  // feedback reports. without a key the SDK falls back to ANTHROPIC_AUTH_TOKEN or an
  // `ant auth login` profile
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",
  feedbackModel: process.env.FEEDBACK_MODEL ?? "claude-opus-5-5",
  feedbackEffort: (process.env.FEEDBACK_EFFORT ?? "high") as
    "low" | "medium" | "high" | "xhigh" | "max",
  openaiApiKey: process.env.OPENAI_API_KEY ?? "",
  // defaults are what the OpenAI realtime docs recommended as of Oct 2026
  realtimeModel: process.env.OPENAI_REALTIME_MODEL ?? "gpt-realtime-2.1",
  realtimeVoice: process.env.OPENAI_REALTIME_VOICE ?? "marin",
  transcribeModel: process.env.OPENAI_TRANSCRIBE_MODEL ?? "gpt-4o-mini-transcribe",

  // code execution. the public CE instance needs no key but is slow and shared; point this
  // at RapidAPI or a self-hosted Judge0 for anything real
  judge0Url: process.env.JUDGE0_URL ?? "https://ce.judge0.com",
  // self-hosted Judge0 auth (X-Auth-Token)
  judge0AuthToken: process.env.JUDGE0_AUTH_TOKEN ?? "",
  // RapidAPI-hosted Judge0 auth
  judge0RapidApiKey: process.env.JUDGE0_RAPIDAPI_KEY ?? "",
  judge0RapidApiHost: process.env.JUDGE0_RAPIDAPI_HOST ?? "judge0-ce.p.rapidapi.com",
  // JSON like {"python":71} when your instance numbers languages differently
  judge0LanguageIds: process.env.JUDGE0_LANGUAGE_IDS ?? "",
  // per test case. generous by default because the public instance adds ~2s of overhead
  runCpuTimeSec: Number(process.env.RUN_CPU_TIME_SEC ?? 5),
  runMemoryMb: Number(process.env.RUN_MEMORY_MB ?? 256),
};
