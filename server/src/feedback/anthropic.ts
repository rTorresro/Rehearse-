import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { CallModel } from "./generate.js";
import { ReportDraftSchema } from "./schema.js";

// JSON schema straight from the zod schema, so the two can't drift. we validate the text
// ourselves (rather than letting the SDK parse) so a bad attempt can be explained back
const format = betaZodOutputFormat(ReportDraftSchema);

export function anthropicCaller(opts: {
  apiKey?: string;
  model: string;
  effort: "low" | "medium" | "high" | "xhigh" | "max";
}): CallModel {
  // with no key, the SDK falls back to ANTHROPIC_AUTH_TOKEN or an `ant auth login` profile
  const client = new Anthropic(opts.apiKey ? { apiKey: opts.apiKey } : {});
  return async ({ system, messages }) => {
    // streamed: thinking plus a full report can run long enough to trip a plain request's timeout
    const stream = client.beta.messages.stream({
      model: opts.model,
      max_tokens: 32000,
      system,
      messages,
      thinking: { type: "adaptive" },
      output_config: { effort: opts.effort, format: { type: format.type, schema: format.schema } },
      // if this model declines on a safety classifier, the API retries on a suitable fallback
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
    });
    const message = await stream.finalMessage();
    const text = [...message.content].reverse().find((b) => b.type === "text");
    return {
      stopReason: message.stop_reason,
      text: text?.type === "text" ? text.text : null,
      content: message.content,
    };
  };
}
