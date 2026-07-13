/**
 * Node runners.
 *
 * Each NodeKind maps to a runner that knows how to execute one node of that
 * kind. Runners are pure functions of (config, input, ctx) → output; they
 * do not touch the database, the renderer, or each other. The executor
 * feeds each runner its upstream outputs and routes the result downstream.
 *
 * v1 scope:
 *  - text-generation: calls ai-gateway.complete() for real.
 *  - prompt-template: pure string interpolation, no LLM call.
 *  - review-gate: halts the run (throws AwaitReviewError).
 *  - pass-through: echoes upstream input (default for legacy nodes).
 *  - image/video/audio/voice/export: parameterized but stubbed — throw a
 *    clear "not yet implemented" so the architecture is ready for real
 *    media runners in a follow-up PR.
 */
import { complete, type AIMessage, type ApiKeyResolver } from "@main/services/ai-gateway.js";
import type { NodeConfig, NodeKind } from "@shared/production/node-types.js";

/** Context handed to every runner. The signal is the cancellation channel. */
export interface NodeRunnerContext {
  getKey: ApiKeyResolver;
  signal: AbortSignal;
}

/** Input to a runner: a node's gathered upstream outputs, keyed by upstream node id. */
export type NodeRunnerInput = Record<string, unknown>;

/** The runner contract. Output is opaque — it's serialized to JSON downstream. */
export interface NodeRunner {
  readonly kind: NodeKind;
  run(args: {
    config: NodeConfig;
    input: NodeRunnerInput;
    ctx: NodeRunnerContext;
  }): Promise<unknown>;
}

/**
 * Thrown when a review-gate node is reached. The executor catches this to
 * transition the run to the `awaiting-review` terminal state rather than
 * treating it as a failure.
 */
export class AwaitReviewError extends Error {
  constructor(
    readonly nodeId: string,
    message: string,
  ) {
    super(message);
    this.name = "AwaitReviewError";
  }
}

/**
 * Resolve `{{...}}` placeholders in a template string against upstream
 * outputs. Supports `{{nodeId.output}}` (the upstream node's full output,
 * stringified if non-string) and a bare `{{nodeId}}` shorthand.
 *
 * Unknown placeholders are left untouched rather than blanked, so missing
 * upstream data is visible in the rendered prompt.
 */
export function interpolate(template: string, input: NodeRunnerInput): string {
  return template.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_match, expr: string) => {
    const key = expr.trim();
    // "{{nodeId.output}}" or "{{nodeId}}" — both resolve to the upstream value.
    const ref = key.endsWith(".output") ? key.slice(0, -".output".length) : key;
    const value = input[ref];
    if (value === undefined) return `{{${expr}}}`; // leave unknown untouched
    return typeof value === "string" ? value : JSON.stringify(value);
  });
}

// ---------------------------------------------------------------------------
// Runners
// ---------------------------------------------------------------------------

/** text-generation — runs a prompt through the AI gateway. */
export const textGenerationRunner: NodeRunner = {
  kind: "text-generation",
  async run({ config, input, ctx }) {
    const prompt = interpolate(config.prompt ?? "", input);
    if (!prompt.trim()) {
      throw new Error("text-generation node has no prompt configured.");
    }
    const messages: AIMessage[] = [];
    if (config.systemPrompt?.trim()) {
      messages.push({ role: "system", content: config.systemPrompt });
    }
    messages.push({ role: "user", content: prompt });
    const result = await complete(
      messages,
      {
        model: config.model,
        temperature: config.temperature,
        maxTokens: config.maxTokens,
      },
      ctx.getKey,
    );
    return result.content;
  },
};

/** prompt-template — renders placeholders with no LLM call. */
export const promptTemplateRunner: NodeRunner = {
  kind: "prompt-template",
  async run({ config, input }) {
    const rendered = interpolate(config.prompt ?? "", input);
    if (!rendered.trim()) {
      throw new Error("prompt-template node produced an empty string.");
    }
    return rendered;
  },
};

/** review-gate — halts the run for human review. */
export const reviewGateRunner: NodeRunner = {
  kind: "review-gate",
  async run({ config }) {
    throw new AwaitReviewError(
      "",
      config.prompt ?? "Review gate reached — execution paused for human review.",
    );
  },
};

/** pass-through — echoes upstream input (the default for legacy nodes). */
export const passThroughRunner: NodeRunner = {
  kind: "pass-through",
  async run({ input }) {
    // If exactly one upstream, forward its output directly; otherwise forward
    // the whole input map. This keeps simple chains intuitive.
    const values = Object.values(input);
    return values.length === 1 ? values[0] : input;
  },
};

/**
 * Build a stub runner for a kind whose real runner isn't implemented yet.
 * The node is valid and parameterized (config is captured), but executing it
 * fails with a clear message so the gap is obvious, not silent.
 */
export function stubRunner(kind: NodeKind, label: string): NodeRunner {
  return {
    kind,
    async run() {
      throw new Error(
        `${label} runner not yet implemented. The node is valid and its config ` +
          `is stored, but generation for "${kind}" arrives in a follow-up.`,
      );
    },
  };
}

/**
 * The runner registry. The executor looks up `node.data.nodeKind` here to
 * find the handler for a node. Kinds absent from this map are an error
 * (UnknownNodeKindError) at execution time.
 */
export const RUNNERS: ReadonlyMap<NodeKind, NodeRunner> = new Map<
  NodeKind,
  NodeRunner
>([
  ["text-generation", textGenerationRunner],
  ["prompt-template", promptTemplateRunner],
  ["review-gate", reviewGateRunner],
  ["pass-through", passThroughRunner],
  ["image-generation", stubRunner("image-generation", "Image generation")],
  ["video-generation", stubRunner("video-generation", "Video generation")],
  ["audio-generation", stubRunner("audio-generation", "Audio generation")],
  ["voice-synthesis", stubRunner("voice-synthesis", "Voice synthesis")],
  ["export", stubRunner("export", "Export")],
]);
