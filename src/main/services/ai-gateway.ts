/**
 * AI Gateway — routes AI requests to the correct provider, handles streaming.
 * Uses the model registry for routing and the API key service for auth.
 */
import { createLogger } from "@main/core/logger.js";
import { getModel, listModels, getProviderEndpoint, type AIProviderId, type AIModelEntry } from "./ai-model-registry.js";

const log = createLogger("ai-gateway");

export interface AIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AICompletionOptions {
  model?: string;
  provider?: AIProviderId;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

/**
 * Resolves an unmasked API key for a provider. Implemented by
 * {@link ApiKeyService.getKey} (main process only); the gateway never
 * touches the key file on disk, so there is a single source of truth.
 */
export type ApiKeyResolver = (provider: AIProviderId) => string | undefined;

export interface AICompletionResult {
  content: string;
  model: string;
  provider: AIProviderId;
  usage: { promptTokens: number; completionTokens: number; totalTokens: number };
}

export interface AIStreamChunk {
  type: "text" | "done" | "error";
  text?: string;
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
  error?: string;
}

function buildHeaders(provider: AIProviderId, apiKey: string): Record<string, string> {
  switch (provider) {
    case "anthropic":
      return {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      };
    case "google":
      return { "content-type": "application/json" };
    default:
      return {
        "authorization": `Bearer ${apiKey}`,
        "content-type": "application/json",
      };
  }
}

function buildRequestBody(
  provider: AIProviderId,
  model: string,
  messages: AIMessage[],
  options: { temperature?: number; maxTokens?: number; stream?: boolean },
): Record<string, unknown> {
  const temperature = options.temperature ?? 0.7;
  const maxTokens = options.maxTokens ?? 4096;

  switch (provider) {
    case "anthropic":
      return {
        model,
        messages: messages.filter((m) => m.role !== "system"),
        system: messages.find((m) => m.role === "system")?.content,
        max_tokens: maxTokens,
        temperature,
        stream: options.stream,
      };
    case "google": {
      const contents = messages
        .filter((m) => m.role !== "system")
        .map((m) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        }));
      return {
        contents,
        generationConfig: { temperature, maxOutputTokens: maxTokens },
        stream: options.stream,
      };
    }
    default:
      return {
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
        stream: options.stream,
      };
  }
}

function parseStreamLine(provider: AIProviderId, line: string): AIStreamChunk | null {
  if (!line.startsWith("data: ")) return null;
  const data = line.slice(6).trim();
  if (data === "[DONE]") return { type: "done" };
  try {
    const parsed = JSON.parse(data) as Record<string, unknown>;
    if (provider === "anthropic") {
      const event = parsed as { type?: string; delta?: { text?: string }; message?: { usage?: { input_tokens?: number; output_tokens?: number } } };
      if (event.type === "content_block_delta" && event.delta?.text) {
        return { type: "text", text: event.delta.text };
      }
      if (event.type === "message_stop") {
        return { type: "done" };
      }
    } else {
      const choices = (parsed.choices ?? []) as Array<{ delta?: { content?: string } }>;
      const text = choices[0]?.delta?.content;
      if (text) return { type: "text", text };
      const usage = parsed.usage as { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | undefined;
      if (usage) {
        return {
          type: "done",
          usage: {
            promptTokens: usage.prompt_tokens ?? 0,
            completionTokens: usage.completion_tokens ?? 0,
            totalTokens: usage.total_tokens ?? 0,
          },
        };
      }
    }
  } catch { /* ignore parse errors in streaming */ }
  return null;
}

export async function complete(
  messages: AIMessage[],
  options: AICompletionOptions = {},
  getKey: ApiKeyResolver,
): Promise<AICompletionResult> {
  const modelId = options.model ?? "gpt-4o-mini";
  const model = getModel(modelId);
  if (!model) throw new Error(`Unknown model: ${modelId}`);

  const provider = options.provider ?? model.provider;
  const apiKey = getKey(provider);
  if (!apiKey && provider !== "ollama") {
    throw new Error(`No API key configured for ${provider}. Add it in Settings → API Keys.`);
  }

  const endpoint = getProviderEndpoint(provider);
  const headers = buildHeaders(provider, apiKey ?? "");
  const body = buildRequestBody(provider, modelId, messages, {
    temperature: options.temperature,
    maxTokens: options.maxTokens,
    stream: false,
  });

  const url = provider === "google"
    ? `${endpoint}/${modelId}:generateContent?key=${apiKey}`
    : endpoint;

  log.info("AI completion request", { model: modelId, provider });

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    log.error("AI completion failed", { status: response.status, error: errorText });
    throw new Error(`AI request failed (${response.status}): ${errorText}`);
  }

  const result = await response.json() as Record<string, unknown>;

  let content = "";
  let usage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

  if (provider === "anthropic") {
    const r = result as { content?: Array<{ text?: string }>; usage?: { input_tokens?: number; output_tokens?: number } };
    content = r.content?.map((c) => c.text ?? "").join("") ?? "";
    if (r.usage) {
      usage = {
        promptTokens: r.usage.input_tokens ?? 0,
        completionTokens: r.usage.output_tokens ?? 0,
        totalTokens: (r.usage.input_tokens ?? 0) + (r.usage.output_tokens ?? 0),
      };
    }
  } else if (provider === "google") {
    const r = result as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>; usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number } };
    content = r.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    if (r.usageMetadata) {
      usage = {
        promptTokens: r.usageMetadata.promptTokenCount ?? 0,
        completionTokens: r.usageMetadata.candidatesTokenCount ?? 0,
        totalTokens: r.usageMetadata.totalTokenCount ?? 0,
      };
    }
  } else {
    const r = result as { choices?: Array<{ message?: { content?: string } }>; usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } };
    content = r.choices?.[0]?.message?.content ?? "";
    if (r.usage) {
      usage = {
        promptTokens: r.usage.prompt_tokens ?? 0,
        completionTokens: r.usage.completion_tokens ?? 0,
        totalTokens: r.usage.total_tokens ?? 0,
      };
    }
  }

  log.info("AI completion done", { model: modelId, tokens: usage.totalTokens });

  return { content, model: modelId, provider, usage };
}

export async function* stream(
  messages: AIMessage[],
  options: AICompletionOptions = {},
  getKey: ApiKeyResolver,
  signal?: AbortSignal,
): AsyncGenerator<AIStreamChunk> {
  const modelId = options.model ?? "gpt-4o-mini";
  const model = getModel(modelId);
  if (!model) throw new Error(`Unknown model: ${modelId}`);

  // Bail out early if already aborted before any network work starts.
  if (signal?.aborted) return;

  const provider = options.provider ?? model.provider;
  const apiKey = getKey(provider);
  if (!apiKey && provider !== "ollama") {
    throw new Error(`No API key configured for ${provider}. Add it in Settings → API Keys.`);
  }

  const endpoint = getProviderEndpoint(provider);
  const headers = buildHeaders(provider, apiKey ?? "");
  const body = buildRequestBody(provider, modelId, messages, {
    temperature: options.temperature,
    maxTokens: options.maxTokens,
    stream: true,
  });

  const url = provider === "google"
    ? `${endpoint}/${modelId}:streamGenerateContent?alt=sse&key=${apiKey}`
    : endpoint;

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal,
    });
  } catch (err) {
    // AbortError is a clean cancellation, not a failure — just stop.
    if (signal?.aborted || (err instanceof Error && err.name === "AbortError")) return;
    throw err;
  }

  if (!response.ok) {
    const errorText = await response.text();
    yield { type: "error", error: `AI request failed (${response.status}): ${errorText}` };
    return;
  }

  const reader = response.body?.getReader();
  if (!reader) {
    yield { type: "error", error: "No response body" };
    return;
  }

  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const chunk = parseStreamLine(provider, line);
        if (chunk) yield chunk;
      }

      // Check abort between reads so cancellation is prompt, not just at the
      // next fetch rejection. The provider keeps streaming tokens otherwise.
      if (signal?.aborted) {
        await reader.cancel().catch(() => {});
        return;
      }
    }

    if (buffer.trim()) {
      const chunk = parseStreamLine(provider, buffer);
      if (chunk) yield chunk;
    }

    yield { type: "done" };
  } catch (err) {
    // A mid-stream abort rejects reader.read(); treat as clean stop.
    if (signal?.aborted || (err instanceof Error && err.name === "AbortError")) return;
    // Release the reader on any other error before re-throwing.
    await reader.cancel().catch(() => {});
    throw err;
  }
}

export { listModels, getModel, type AIModelEntry };
