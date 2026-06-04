import type { AiProvider, AiCompletionInput, AiCompletionResult } from "./types";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

/**
 * Anthropic provider. Only used when ANTHROPIC_API_KEY is set.
 * Calls the Messages API directly to avoid pulling in the full SDK at MVP.
 */
export function makeAnthropicProvider(opts: {
  apiKey: string;
  model?: string;
}): AiProvider {
  const model = opts.model ?? "claude-sonnet-4-6";
  return {
    name: "anthropic",
    defaultModel: model,
    async generate(input: AiCompletionInput): Promise<AiCompletionResult> {
      const res = await fetch(ANTHROPIC_API_URL, {
        method: "POST",
        headers: {
          "x-api-key": opts.apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model,
          max_tokens: input.maxTokens ?? 1024,
          temperature: input.temperature ?? 0.3,
          system: input.systemPrompt,
          messages: [{ role: "user", content: input.userPrompt }],
        }),
      });
      if (!res.ok) {
        throw new Error(`Anthropic API ${res.status}: ${await res.text()}`);
      }
      const json = (await res.json()) as {
        content: Array<{ type: string; text?: string }>;
      };
      const output = json.content
        .filter((c) => c.type === "text" && typeof c.text === "string")
        .map((c) => c.text)
        .join("\n")
        .trim();
      return { provider: "anthropic", model, output };
    },
  };
}
