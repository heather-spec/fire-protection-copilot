export interface AiCompletionInput {
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
}

export interface AiCompletionResult {
  provider: "anthropic" | "openai" | "mock";
  model: string;
  output: string;
}

export interface AiProvider {
  name: "anthropic" | "openai" | "mock";
  defaultModel: string;
  generate(input: AiCompletionInput): Promise<AiCompletionResult>;
}
