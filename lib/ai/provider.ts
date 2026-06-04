import type { AiProvider } from "./types";
import { mockProvider } from "./mock";
import { makeAnthropicProvider } from "./anthropic";
import { makeOpenAiProvider } from "./openai";

/**
 * Resolves the active AI provider based on environment.
 * Priority: explicit AI_PROVIDER env var > Anthropic key > OpenAI key > mock.
 *
 * Always available. If nothing is configured, the mock provider keeps
 * the demo working — it never invents NFPA codes, it only rearranges
 * input text into a plausible narrative.
 */
export function getAiProvider(): AiProvider {
  const explicit = process.env.AI_PROVIDER?.toLowerCase();
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  if (explicit === "mock") return mockProvider;
  if (explicit === "anthropic" && anthropicKey) {
    return makeAnthropicProvider({ apiKey: anthropicKey, model: process.env.AI_MODEL });
  }
  if (explicit === "openai" && openaiKey) {
    return makeOpenAiProvider({ apiKey: openaiKey, model: process.env.AI_MODEL });
  }
  if (anthropicKey) {
    return makeAnthropicProvider({ apiKey: anthropicKey, model: process.env.AI_MODEL });
  }
  if (openaiKey) {
    return makeOpenAiProvider({ apiKey: openaiKey, model: process.env.AI_MODEL });
  }
  return mockProvider;
}
