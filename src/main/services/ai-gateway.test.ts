/**
 * AI Gateway tests.
 *
 * Mocks `fetch` for network calls and supplies API keys via an injected
 * resolver (mirroring how ApiKeyService.getKey feeds the gateway in prod).
 * Verifies provider-specific request shaping, response parsing, stream SSE
 * line parsing, error handling, and the "no API key" guard.
 */
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import type { AIMessage, ApiKeyResolver } from "./ai-gateway.js";

// ---------------------------------------------------------------------------
// Logger stub — prevent log calls from polluting output.
// ---------------------------------------------------------------------------
vi.mock("@main/core/logger.js", () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

// ---------------------------------------------------------------------------
// Global fetch mock
// ---------------------------------------------------------------------------
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// ---------------------------------------------------------------------------
// API key resolver — stands in for ApiKeyService.getKey in tests.
// ---------------------------------------------------------------------------
const FAKE_KEYS: Record<string, string> = {
  openai: "sk-test-openai",
  anthropic: "sk-ant-test",
  google: "AIzaSy-test-google",
  mistral: "sk-mistral-test",
  fireworks: "fw-test",
  deepseek: "ds-test",
  ollama: "",
};

/** Resolver that returns a fake key per provider (undefined when absent). */
const fakeKeyResolver: ApiKeyResolver = (provider) => FAKE_KEYS[provider];

beforeAll(() => {
  // no disk setup — keys come from the resolver
});

afterAll(() => {
  // no temp dir to clean up
});

beforeEach(() => {
  mockFetch.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const systemMsg: AIMessage = { role: "system", content: "You are a helpful assistant." };
const userMsg: AIMessage = { role: "user", content: "Hello!" };

function okJson(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function errorResponse(status: number, text: string): Response {
  return new Response(text, { status, headers: { "content-type": "text/plain" } });
}

/** Build a minimal ReadableStream from an array of SSE lines. */
function sseBody(lines: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const chunks = lines.map((l) => encoder.encode(l + "\n"));
  let i = 0;
  return new ReadableStream({
    pull(controller) {
      if (i < chunks.length) {
        controller.enqueue(chunks[i++]);
      } else {
        controller.close();
      }
    },
  });
}

// ---------------------------------------------------------------------------
// Tests — complete()
// ---------------------------------------------------------------------------

describe("complete()", () => {
  it("calls OpenAI with Bearer auth and parses choices", async () => {
    mockFetch.mockResolvedValueOnce(
      okJson({
        choices: [{ message: { content: "Hi there!" } }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      }),
    );

    const { complete } = await import("./ai-gateway.js");
    const result = await complete([systemMsg, userMsg], { model: "gpt-4o-mini" }, fakeKeyResolver);

    const [url, init] = mockFetch.mock.calls[0]!;
    expect(url).toBe("https://api.openai.com/v1/chat/completions");

    const headers = init!.headers as Record<string, string>;
    expect(headers["authorization"]).toBe("Bearer sk-test-openai");

    const body = JSON.parse(init!.body as string) as Record<string, unknown>;
    expect(body.model).toBe("gpt-4o-mini");
    expect(body.temperature).toBe(0.7);
    expect(body.max_tokens).toBe(4096);
    expect(body.stream).toBe(false);
    expect(Array.isArray(body.messages)).toBe(true);
    expect((body.messages as AIMessage[])[0]!.role).toBe("system");

    expect(result.content).toBe("Hi there!");
    expect(result.model).toBe("gpt-4o-mini");
    expect(result.provider).toBe("openai");
    expect(result.usage.promptTokens).toBe(10);
    expect(result.usage.completionTokens).toBe(5);
    expect(result.usage.totalTokens).toBe(15);
  });

  it("calls Anthropic with x-api-key header and system field", async () => {
    mockFetch.mockResolvedValueOnce(
      okJson({
        content: [{ text: "Claude says hello!" }],
        usage: { input_tokens: 8, output_tokens: 4 },
      }),
    );

    const { complete } = await import("./ai-gateway.js");
    const result = await complete([systemMsg, userMsg], {
      model: "claude-sonnet-4-20250514",
    }, fakeKeyResolver);

    const [url, init] = mockFetch.mock.calls[0]!;
    expect(url).toBe("https://api.anthropic.com/v1/messages");

    const headers = init!.headers as Record<string, string>;
    expect(headers["x-api-key"]).toBe("sk-ant-test");
    expect(headers["anthropic-version"]).toBe("2023-06-01");

    const body = JSON.parse(init!.body as string) as Record<string, unknown>;
    expect(body.model).toBe("claude-sonnet-4-20250514");
    expect(body.system).toBe("You are a helpful assistant.");
    expect(body.messages).toEqual([{ role: "user", content: "Hello!" }]);

    expect(result.content).toBe("Claude says hello!");
    expect(result.provider).toBe("anthropic");
    expect(result.usage.promptTokens).toBe(8);
    expect(result.usage.completionTokens).toBe(4);
    expect(result.usage.totalTokens).toBe(12);
  });

  it("calls Google with contents format and key in URL", async () => {
    mockFetch.mockResolvedValueOnce(
      okJson({
        candidates: [
          {
            content: {
              parts: [{ text: "Gemini responds!" }],
            },
          },
        ],
        usageMetadata: {
          promptTokenCount: 12,
          candidatesTokenCount: 6,
          totalTokenCount: 18,
        },
      }),
    );

    const { complete } = await import("./ai-gateway.js");
    const result = await complete([userMsg], { model: "gemini-2.0-flash" }, fakeKeyResolver);

    const [url, init] = mockFetch.mock.calls[0]!;
    expect(url).toBe(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=AIzaSy-test-google",
    );

    const body = JSON.parse(init!.body as string) as Record<string, unknown>;
    expect(body.contents).toEqual([
      { role: "user", parts: [{ text: "Hello!" }] },
    ]);
    expect(body.generationConfig).toEqual({
      temperature: 0.7,
      maxOutputTokens: 4096,
    });

    expect(result.content).toBe("Gemini responds!");
    expect(result.provider).toBe("google");
    expect(result.usage.promptTokens).toBe(12);
    expect(result.usage.completionTokens).toBe(6);
    expect(result.usage.totalTokens).toBe(18);
  });

  it("passes through assistant role for Google as 'model'", async () => {
    mockFetch.mockResolvedValueOnce(
      okJson({
        candidates: [{ content: { parts: [{ text: "ok" }] } }],
      }),
    );

    const { complete } = await import("./ai-gateway.js");
    await complete(
      [
        { role: "user", content: "Hi" },
        { role: "assistant", content: "Hello" },
        { role: "user", content: "Bye" },
      ],
      { model: "gemini-2.0-flash" },
      fakeKeyResolver,
    );

    const body = JSON.parse(
      (mockFetch.mock.calls[0]![1]!.body as string),
    ) as Record<string, unknown>;
    expect(body.contents).toEqual([
      { role: "user", parts: [{ text: "Hi" }] },
      { role: "model", parts: [{ text: "Hello" }] },
      { role: "user", parts: [{ text: "Bye" }] },
    ]);
  });

  it("passes custom temperature and maxTokens", async () => {
    mockFetch.mockResolvedValueOnce(okJson({ choices: [{ message: { content: "" } }] }));

    const { complete } = await import("./ai-gateway.js");
    await complete([userMsg], {
      model: "gpt-4o-mini",
      temperature: 0.2,
      maxTokens: 100,
    }, fakeKeyResolver);

    const body = JSON.parse(
      (mockFetch.mock.calls[0]![1]!.body as string),
    ) as Record<string, unknown>;
    expect(body.temperature).toBe(0.2);
    expect(body.max_tokens).toBe(100);
  });

  it("throws on unknown model", async () => {
    const { complete } = await import("./ai-gateway.js");
    await expect(complete([userMsg], { model: "nonexistent-model" }, fakeKeyResolver)).rejects.toThrow(
      "Unknown model: nonexistent-model",
    );
  });

  it("throws when no API key is configured", async () => {
    const { complete } = await import("./ai-gateway.js");
    // Resolver returns undefined for every provider — simulates "no keys set".
    const noKeyResolver = () => undefined;
    await expect(complete([userMsg], { model: "gpt-4o-mini" }, noKeyResolver)).rejects.toThrow(
      /No API key configured for openai/,
    );
  });

  it("does not require API key for ollama provider", async () => {
    mockFetch.mockResolvedValueOnce(
      okJson({ choices: [{ message: { content: "Local response" } }] }),
    );

    const { complete } = await import("./ai-gateway.js");
    const result = await complete([userMsg], { model: "llama3.1" }, fakeKeyResolver);

    expect(result.content).toBe("Local response");
    expect(result.provider).toBe("ollama");
  });

  it("throws on non-ok response", async () => {
    mockFetch.mockResolvedValueOnce(errorResponse(401, "Unauthorized"));

    const { complete } = await import("./ai-gateway.js");
    await expect(complete([userMsg], { model: "gpt-4o-mini" }, fakeKeyResolver)).rejects.toThrow(
      /AI request failed \(401\): Unauthorized/,
    );
  });

  it("defaults to gpt-4o-mini when no model specified", async () => {
    mockFetch.mockResolvedValueOnce(okJson({ choices: [{ message: { content: "" } }] }));

    const { complete } = await import("./ai-gateway.js");
    await complete([userMsg], {}, fakeKeyResolver);

    const body = JSON.parse(
      (mockFetch.mock.calls[0]![1]!.body as string),
    ) as Record<string, unknown>;
    expect(body.model).toBe("gpt-4o-mini");
  });
});

// ---------------------------------------------------------------------------
// Tests — stream()
// ---------------------------------------------------------------------------

describe("stream()", () => {
  it("yields text chunks and done for OpenAI SSE format", async () => {
    const sseLines = [
      'data: {"choices":[{"delta":{"content":"Hello"}}]}',
      'data: {"choices":[{"delta":{"content":" world"}}]}',
      'data: [DONE]',
    ];
    mockFetch.mockResolvedValueOnce(
      new Response(sseBody(sseLines), {
        status: 200,
        headers: { "content-type": "text/event-stream" },
      }),
    );

    const { stream } = await import("./ai-gateway.js");
    const chunks: Array<{ type: string; text?: string }> = [];
    for await (const chunk of stream([userMsg], { model: "gpt-4o-mini" }, fakeKeyResolver)) {
      chunks.push(chunk);
    }

    // stream() yields done from parseStreamLine([DONE]) AND a final done
    // at the end of the generator, so two "done" chunks are expected.
    expect(chunks).toEqual([
      { type: "text", text: "Hello" },
      { type: "text", text: " world" },
      { type: "done" },
      { type: "done" },
    ]);
  });

  it("yields text chunks and done for Anthropic SSE format", async () => {
    const sseLines = [
      'data: {"type":"content_block_delta","delta":{"text":"Hi"}}',
      'data: {"type":"content_block_delta","delta":{"text":" there"}}',
      'data: {"type":"message_stop"}',
    ];
    mockFetch.mockResolvedValueOnce(
      new Response(sseBody(sseLines), {
        status: 200,
        headers: { "content-type": "text/event-stream" },
      }),
    );

    const { stream } = await import("./ai-gateway.js");
    const chunks: Array<{ type: string; text?: string }> = [];
    for await (const chunk of stream([userMsg], { model: "claude-sonnet-4-20250514" }, fakeKeyResolver)) {
      chunks.push(chunk);
    }

    // message_stop yields done from parseStreamLine AND the final generator done.
    expect(chunks).toEqual([
      { type: "text", text: "Hi" },
      { type: "text", text: " there" },
      { type: "done" },
      { type: "done" },
    ]);
  });

  it("yields text chunks for OpenAI-style delta used by Mistral/DeepSeek/Fireworks", async () => {
    const sseLines = [
      'data: {"choices":[{"delta":{"content":"Fireworks"}}]}',
      'data: [DONE]',
    ];
    mockFetch.mockResolvedValueOnce(
      new Response(sseBody(sseLines), {
        status: 200,
        headers: { "content-type": "text/event-stream" },
      }),
    );

    const { stream } = await import("./ai-gateway.js");
    const chunks: Array<{ type: string; text?: string }> = [];
    for await (const chunk of stream([userMsg], { model: "deepseek-chat" }, fakeKeyResolver)) {
      chunks.push(chunk);
    }

    expect(chunks).toEqual([
      { type: "text", text: "Fireworks" },
      { type: "done" },
      { type: "done" },
    ]);
  });

  it("yields usage from OpenAI-style stream with usage field", async () => {
    const sseLines = [
      'data: {"choices":[{"delta":{"content":"Hi"}}]}',
      'data: {"usage":{"prompt_tokens":10,"completion_tokens":2,"total_tokens":12}}',
      "data: [DONE]",
    ];
    mockFetch.mockResolvedValueOnce(
      new Response(sseBody(sseLines), {
        status: 200,
        headers: { "content-type": "text/event-stream" },
      }),
    );

    const { stream } = await import("./ai-gateway.js");
    const chunks: Array<{ type: string; text?: string; usage?: unknown }> = [];
    for await (const chunk of stream([userMsg], { model: "gpt-4o-mini" }, fakeKeyResolver)) {
      chunks.push(chunk);
    }

    const usageChunk = chunks.find((c) => c.type === "done" && c.usage);
    expect(usageChunk).toBeDefined();
    expect(usageChunk!.usage).toEqual({
      promptTokens: 10,
      completionTokens: 2,
      totalTokens: 12,
    });
  });

  it("yields error on non-ok response", async () => {
    mockFetch.mockResolvedValueOnce(errorResponse(429, "Rate limited"));

    const { stream } = await import("./ai-gateway.js");
    const chunks: Array<{ type: string; error?: string }> = [];
    for await (const chunk of stream([userMsg], { model: "gpt-4o-mini" }, fakeKeyResolver)) {
      chunks.push(chunk);
    }

    expect(chunks).toEqual([
      { type: "error", error: "AI request failed (429): Rate limited" },
    ]);
  });

  it("yields error when response body is null", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(null, { status: 200, headers: { "content-type": "text/event-stream" } }),
    );

    const { stream } = await import("./ai-gateway.js");
    const chunks: Array<{ type: string; error?: string }> = [];
    for await (const chunk of stream([userMsg], { model: "gpt-4o-mini" }, fakeKeyResolver)) {
      chunks.push(chunk);
    }

    expect(chunks).toEqual([{ type: "error", error: "No response body" }]);
  });

  it("skips lines without 'data: ' prefix", async () => {
    const sseLines = [
      ": ping",
      "",
      'event: message',
      'data: {"choices":[{"delta":{"content":"ok"}}]}',
      "data: [DONE]",
    ];
    mockFetch.mockResolvedValueOnce(
      new Response(sseBody(sseLines), {
        status: 200,
        headers: { "content-type": "text/event-stream" },
      }),
    );

    const { stream } = await import("./ai-gateway.js");
    const chunks: Array<{ type: string; text?: string }> = [];
    for await (const chunk of stream([userMsg], { model: "gpt-4o-mini" }, fakeKeyResolver)) {
      chunks.push(chunk);
    }

    expect(chunks).toEqual([
      { type: "text", text: "ok" },
      { type: "done" },
      { type: "done" },
    ]);
  });

  it("throws on unknown model", async () => {
    const { stream } = await import("./ai-gateway.js");
    const gen = stream([userMsg], { model: "nonexistent-model" }, fakeKeyResolver);
    await expect(gen.next()).rejects.toThrow("Unknown model: nonexistent-model");
  });

  it("throws when no API key is configured", async () => {
    const { stream } = await import("./ai-gateway.js");
    // Resolver returns undefined for every provider — simulates "no keys set".
    const noKeyResolver = () => undefined;
    const gen = stream([userMsg], { model: "gpt-4o-mini" }, noKeyResolver);
    await expect(gen.next()).rejects.toThrow(/No API key configured for openai/);
  });

  it("sets stream: true in request body", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(sseBody(["data: [DONE]"]), {
        status: 200,
        headers: { "content-type": "text/event-stream" },
      }),
    );

    const { stream } = await import("./ai-gateway.js");
    for await (const _ of stream([userMsg], { model: "gpt-4o-mini" }, fakeKeyResolver)) {
      /* drain */
    }

    const body = JSON.parse(
      (mockFetch.mock.calls[0]![1]!.body as string),
    ) as Record<string, unknown>;
    expect(body.stream).toBe(true);
  });

  it("does not require API key for ollama streaming", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(
        sseBody([
          'data: {"choices":[{"delta":{"content":"local"}}]}',
          "data: [DONE]",
        ]),
        {
          status: 200,
          headers: { "content-type": "text/event-stream" },
        },
      ),
    );

    const { stream } = await import("./ai-gateway.js");
    const chunks: Array<{ type: string; text?: string }> = [];
    for await (const chunk of stream([userMsg], { model: "llama3.1" }, fakeKeyResolver)) {
      chunks.push(chunk);
    }

    expect(chunks).toEqual([
      { type: "text", text: "local" },
      { type: "done" },
      { type: "done" },
    ]);
  });

  it("Google stream uses alt=sse in URL", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(sseBody(["data: [DONE]"]), {
        status: 200,
        headers: { "content-type": "text/event-stream" },
      }),
    );

    const { stream } = await import("./ai-gateway.js");
    for await (const _ of stream([userMsg], { model: "gemini-2.0-flash" }, fakeKeyResolver)) {
      /* drain */
    }

    const [url] = mockFetch.mock.calls[0]!;
    expect(url).toContain("alt=sse");
    expect(url).toContain("key=AIzaSy-test-google");
  });
});

// ---------------------------------------------------------------------------
// Tests — re-exports
// ---------------------------------------------------------------------------

describe("re-exports", () => {
  it("listModels returns all registered models", async () => {
    const { listModels } = await import("./ai-gateway.js");
    const models = listModels();
    expect(models.length).toBeGreaterThan(0);
    expect(models.map((m) => m.id)).toContain("gpt-4o-mini");
    expect(models.map((m) => m.id)).toContain("claude-sonnet-4-20250514");
    expect(models.map((m) => m.id)).toContain("gemini-2.0-flash");
  });

  it("getModel returns a specific model entry", async () => {
    const { getModel } = await import("./ai-gateway.js");
    const model = getModel("gpt-4o");
    expect(model).toBeDefined();
    expect(model!.provider).toBe("openai");
    expect(model!.displayName).toBe("GPT-4o");
  });

  it("getModel returns undefined for unknown id", async () => {
    const { getModel } = await import("./ai-gateway.js");
    expect(getModel("totally-fake")).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Integration: ApiKeyService → gateway round-trip (regression test for #24).
// Pins the contract that a key saved via the Preferences panel (ApiKeyService)
// is visible to the AI gateway when the resolver is wired as in production.
// ---------------------------------------------------------------------------

describe("ApiKeyService integration", () => {
  let home: string;

  beforeAll(async () => {
    const { mkdtemp } = await import("node:fs/promises");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    home = await mkdtemp(join(tmpdir(), "artworks-ai-gw-keys-"));
    process.env["AW_HOME"] = home;
  });

  afterAll(async () => {
    const { rm } = await import("node:fs/promises");
    await rm(home, { recursive: true, force: true });
    delete process.env["AW_HOME"];
  });

  it("a key saved via ApiKeyService.setKey is found by complete()", async () => {
    const { ApiKeyService } = await import("./api-key-service.js");
    const { complete } = await import("./ai-gateway.js");

    const service = new ApiKeyService();
    await service.init();
    await service.setKey("openai", "sk-round-trip");

    // Before #24 the gateway read the key file with the wrong JSON shape and
    // returned undefined here, failing with "No API key configured".
    expect(service.getKey("openai")).toBe("sk-round-trip");

    // Confirm complete() proceeds past the key check and reaches fetch,
    // wired exactly as registerProductionIpc wires it in production.
    mockFetch.mockResolvedValueOnce(
      okJson({
        choices: [{ message: { content: "ok" } }],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      }),
    );

    const result = await complete(
      [{ role: "user", content: "hi" }],
      { model: "gpt-4o-mini" },
      (p) => service.getKey(p),
    );
    expect(result.content).toBe("ok");

    const init = mockFetch.mock.calls[0]![1]! as { headers: Record<string, string> };
    expect(init.headers["authorization"]).toBe("Bearer sk-round-trip");
  });
});
