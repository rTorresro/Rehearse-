import { createServer } from "node:http";
import { createApp } from "./app.js";
import { env } from "./env.js";
import { execLimits, judge0FromEnv } from "./execution/config.js";
import { anthropicCaller } from "./feedback/anthropic.js";
import { createReportStore } from "./feedback/reports.js";
import { registry } from "./interview/registry.js";
import { attachInterviewSocket } from "./ws.js";

const reports = createReportStore({
  callModel: anthropicCaller({
    apiKey: env.anthropicApiKey,
    model: env.feedbackModel,
    effort: env.feedbackEffort,
  }),
});
const server = createServer(createApp({ runner: judge0FromEnv(), limits: execLimits, reports }));
attachInterviewSocket(server, { getInterview: registry.get, allowedOrigin: env.webOrigin });

server.listen(env.port, () => {
  console.log(`server on http://localhost:${env.port} (ws at /ws)`);
});
