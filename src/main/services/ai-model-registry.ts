/**
 * AI Model Registry — maps model IDs to providers and capabilities.
 * Used by the AI gateway to route requests to the correct provider.
 */

export type AIProviderId = "openai" | "anthropic" | "google" | "mistral" | "fireworks" | "deepseek" | "ollama";

export interface AIModelEntry {
  readonly id: string;
  readonly provider: AIProviderId;
  readonly displayName: string;
  readonly maxTokens: number;
  readonly supportsStreaming: boolean;
  readonly supportsImages: boolean;
  readonly costPer1kInput: number;
  readonly costPer1kOutput: number;
}

const MODELS: Record<string, AIModelEntry> = {
  "gpt-4o": { id: "gpt-4o", provider: "openai", displayName: "GPT-4o", maxTokens: 128000, supportsStreaming: true, supportsImages: true, costPer1kInput: 0.005, costPer1kOutput: 0.015 },
  "gpt-4o-mini": { id: "gpt-4o-mini", provider: "openai", displayName: "GPT-4o Mini", maxTokens: 128000, supportsStreaming: true, supportsImages: true, costPer1kInput: 0.00015, costPer1kOutput: 0.0006 },
  "gpt-3.5-turbo": { id: "gpt-3.5-turbo", provider: "openai", displayName: "GPT-3.5 Turbo", maxTokens: 16385, supportsStreaming: true, supportsImages: false, costPer1kInput: 0.0005, costPer1kOutput: 0.0015 },
  "claude-sonnet-4-20250514": { id: "claude-sonnet-4-20250514", provider: "anthropic", displayName: "Claude Sonnet 4", maxTokens: 200000, supportsStreaming: true, supportsImages: true, costPer1kInput: 0.003, costPer1kOutput: 0.015 },
  "claude-3-5-haiku-20241022": { id: "claude-3-5-haiku-20241022", provider: "anthropic", displayName: "Claude 3.5 Haiku", maxTokens: 200000, supportsStreaming: true, supportsImages: true, costPer1kInput: 0.001, costPer1kOutput: 0.005 },
  "gemini-2.0-flash": { id: "gemini-2.0-flash", provider: "google", displayName: "Gemini 2.0 Flash", maxTokens: 1048576, supportsStreaming: true, supportsImages: true, costPer1kInput: 0.0001, costPer1kOutput: 0.0004 },
  "gemini-2.5-pro": { id: "gemini-2.5-pro", provider: "google", displayName: "Gemini 2.5 Pro", maxTokens: 1048576, supportsStreaming: true, supportsImages: true, costPer1kInput: 0.00125, costPer1kOutput: 0.01 },
  "mistral-large-latest": { id: "mistral-large-latest", provider: "mistral", displayName: "Mistral Large", maxTokens: 128000, supportsStreaming: true, supportsImages: false, costPer1kInput: 0.002, costPer1kOutput: 0.006 },
  "deepseek-chat": { id: "deepseek-chat", provider: "deepseek", displayName: "DeepSeek Chat", maxTokens: 64000, supportsStreaming: true, supportsImages: false, costPer1kInput: 0.00014, costPer1kOutput: 0.00028 },
  "llama3.1": { id: "llama3.1", provider: "ollama", displayName: "Llama 3.1 (Local)", maxTokens: 131072, supportsStreaming: true, supportsImages: false, costPer1kInput: 0, costPer1kOutput: 0 },
};

export function getModel(id: string): AIModelEntry | undefined {
  return MODELS[id];
}

export function listModels(): AIModelEntry[] {
  return Object.values(MODELS);
}

export function listModelsByProvider(provider: AIProviderId): AIModelEntry[] {
  return Object.values(MODELS).filter((m) => m.provider === provider);
}

export function getProviderEndpoint(provider: AIProviderId): string {
  switch (provider) {
    case "openai": return "https://api.openai.com/v1/chat/completions";
    case "anthropic": return "https://api.anthropic.com/v1/messages";
    case "google": return "https://generativelanguage.googleapis.com/v1beta/models";
    case "mistral": return "https://api.mistral.ai/v1/chat/completions";
    case "fireworks": return "https://api.fireworks.ai/inference/v1/chat/completions";
    case "deepseek": return "https://api.deepseek.com/v1/chat/completions";
    case "ollama": return "http://localhost:11434/api/chat";
    default: throw new Error(`Unknown provider: ${provider}`);
  }
}
