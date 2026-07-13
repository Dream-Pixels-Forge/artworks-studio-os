/**
 * Node-graph execution types.
 *
 * Shared contract between the renderer (node-production panel) and the main
 * process (graph executor). Lives in `shared/` so both sides agree on the
 * semantic node kinds and their config shape.
 *
 * The node graph is the Higgsfield-style "intent → output" surface: nodes
 * declare what they do (their `nodeKind`) and how (their `config`), edges
 * declare data dependencies. The executor topo-sorts and runs each node,
 * feeding each node's upstream outputs into the next.
 *
 * v1 scope (per the approved plan): text-generation and prompt-template run
 * for real against the existing AI gateway; media kinds (image/video/audio/
 * voice/export) are valid, parameterized nodes whose runners throw "not yet
 * implemented" so the architecture is ready for real runners in a follow-up.
 */

/**
 * The semantic node kind — determines which NodeRunner executes the node.
 * The visual `category` (production / ai / prompt / review / publishing)
 * is grouping only; `nodeKind` is what the engine dispatches on.
 *
 * Nodes created before this field existed (legacy graphs) have no `nodeKind`
 * and are treated as `pass-through`.
 */
export type NodeKind =
  | "text-generation" // ✅ runs — calls ai-gateway.complete()
  | "prompt-template" // ✅ runs — pure string interpolation, no LLM call
  | "image-generation" // ⏳ stubbed — runner throws "not yet implemented"
  | "video-generation" // ⏳ stubbed
  | "audio-generation" // ⏳ stubbed
  | "voice-synthesis" // ⏳ stubbed
  | "review-gate" // ✅ runs — halts execution, awaits human review
  | "export" // ⏳ stubbed
  | "pass-through"; // default for legacy nodes with no nodeKind

/** The node kinds whose runners are implemented and will actually execute. */
export const RUNNABLE_NODE_KINDS: readonly NodeKind[] = [
  "text-generation",
  "prompt-template",
  "review-gate",
  "pass-through",
];

/** The node kinds that are parameterized but not yet runnable. */
export const STUBBED_NODE_KINDS: readonly NodeKind[] = [
  "image-generation",
  "video-generation",
  "audio-generation",
  "voice-synthesis",
  "export",
];

/**
 * A node's data, stored in React Flow `node.data` and round-tripped through
 * the existing `JSON.stringify` persistence (the `Record<string, unknown>`
 * base permits arbitrary extra keys). The v2 fields (`nodeKind`, `config`)
 * are absent on legacy nodes and treated as pass-through / empty.
 */
export interface ProductionNodeDataV2 extends Record<string, unknown> {
  label: string;
  /** Visual grouping only (production / ai / prompt / review / publishing). */
  category: string;
  description?: string;
  status?: string;
  /** Semantic kind — what the engine dispatches on. Absent → pass-through. */
  nodeKind?: NodeKind;
  /** Execution config for this node's kind. Absent → empty config. */
  config?: NodeConfig;
}

/**
 * Execution config carried in `node.data`. Kind-specific fields share this
 * interface; the index signature keeps it open-ended so future runners
 * (and the UI property panel) can add fields without churning the type.
 */
export interface NodeConfig {
  /** Prompt body. May contain {{nodeId.output}} placeholders resolved from upstream outputs. */
  prompt?: string;
  /** Optional system prompt prepended to the message list. */
  systemPrompt?: string;
  /** Model id from ai-model-registry (e.g. "gpt-4o-mini"). */
  model?: string;
  /** Sampling temperature (0–2). */
  temperature?: number;
  /** Max generation tokens. */
  maxTokens?: number;
  /** Any kind-specific fields (image size, voice id, etc.) are captured here. */
  [key: string]: unknown;
}

/**
 * A node's execution status, surfaced live in the UI and persisted per step.
 */
export type NodeRunStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "skipped";

/**
 * A run's overall status. `awaiting-review` is the terminal state a
 * review-gate produces; resuming after approval is a v2 concern.
 */
export type GraphRunStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "cancelled"
  | "awaiting-review";

/**
 * Event stream pushed to the renderer during execution. Mirrors the shape
 * of `AIStreamChunk` (a discriminated `type` field) so the renderer can
 * consume it with the same switch-style as AI streaming.
 */
export type NodeExecutionEvent =
  | { type: "run:started"; runId: string; orderedNodeIds: string[] }
  | { type: "node:started"; nodeId: string; nodeKind: NodeKind }
  | { type: "node:completed"; nodeId: string; output: unknown }
  | { type: "node:failed"; nodeId: string; error: string }
  | { type: "node:skipped"; nodeId: string; reason: string }
  | { type: "run:completed"; runId: string }
  | { type: "run:failed"; runId: string; error: string }
  | { type: "run:cancelled"; runId: string };

/** Result returned from a completed graph run. */
export interface GraphRunResult {
  runId: string;
  status: GraphRunStatus;
  /** Final output of every node, keyed by node id. */
  outputs: Record<string, unknown>;
  /** Error message if status is "failed". */
  error?: string;
}
