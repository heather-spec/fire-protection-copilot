import type { AiProvider, AiCompletionInput, AiCompletionResult } from "./types";

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";

/**
 * OpenAI provider. Only used when OPENAI_API_KEY is set.
 */
export function makeOpenAiProvider(opts: {
  apiKey: string;
  model?: string;
}): AiProvider {
  const model = opts.model ?? "gpt-4o-mini";
  return {
    name: "openai",
    defaultModel: model,
    async generate(input: AiCompletionInput): Promise<AiCompletionResult> {
      const res = await fetch(OPENAI_API_URL, {
        method: "POST",
        headers: {
          authorization: `Bearer ${opts.apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model,
          temperature: input.temperature ?? 0.3,
          max_tokens: input.maxTokens ?? 1024,
          messages: [
            { role: "system", content: input.systemPrompt },
            { role: "user", content: input.userPrompt },
          ],
        }),
      });
      if (!res.ok) {
        throw new Error(`OpenAI API ${res.status}: ${await res.text()}`);
      }
      const json = (await res.json()) as {
        choices: Array<{ message: { content: string } }>;
      };
      return {
        provider: "openai",
        model,
        output: json.choices[0]?.message.content ?? "",
      };
    },
  };
}
