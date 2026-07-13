/**
 * Graph executor.
 *
 * Walks a node-workflow DAG in topological order and runs each node via the
 * matching NodeRunner, feeding each node its upstream outputs as input.
 * This is the engine that turns the React Flow canvas from a drawing tool
 * into a generative pipeline (the Higgsfield "intent → output" core).
 *
 * Design:
 *  - Topological sort via Kahn's algorithm; cycles are rejected.
 *  - Nodes at the same depth with no inter-dependency run in parallel.
 *  - Inputs: each node receives `{upstreamNodeId → its output}` for every
 *    incoming edge. Root nodes (no upstream) get `{}`.
 *  - Dispatch: `node.data.nodeKind` → RUNNERS → runner.run(). Missing kind
 *    or missing runner → UnknownNodeKindError.
 *  - Cancel: checks `signal.aborted` before each node; aborts in-flight
 *    work via the same signal (passed into the runner context).
 *  - Fail-fast: first node error stops the run and emits run:failed.
 *  - Review-gate: throws AwaitReviewError, caught → run ends awaiting-review.
 *
 * The executor is DB-free and renderer-free; persistence and IPC push are
 * the caller's job (see node-execution-ipc.ts).
 */
import {
  RUNNERS,
  AwaitReviewError,
  type NodeRunnerContext,
} from "./node-runners.js";
import type {
  GraphRunResult,
  GraphRunStatus,
  NodeExecutionEvent,
  NodeKind,
} from "@shared/production/node-types.js";

// ---------------------------------------------------------------------------
// Engine-local graph types (decoupled from React Flow for testability)
// ---------------------------------------------------------------------------

/**
 * The node shape the executor consumes. Mirrors the React Flow `Node` but
 * without the React dependency, so unit tests can build graphs by hand.
 * `data` is intentionally loose: the executor reads only `nodeKind`.
 */
export interface ExecNode {
  id: string;
  data: {
    nodeKind?: NodeKind;
    config?: Record<string, unknown>;
    [key: string]: unknown;
  };
}

/** A directed edge: source (upstream) → target (downstream). */
export interface ExecEdge {
  source: string;
  target: string;
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

/** The graph contains a cycle — execution order is undefined. */
export class CycleDetectedError extends Error {
  constructor(message = "Graph contains a cycle — cannot determine execution order.") {
    super(message);
    this.name = "CycleDetectedError";
  }
}

/** A node's `nodeKind` has no registered runner. */
export class UnknownNodeKindError extends Error {
  constructor(
    readonly nodeId: string,
    readonly kind: string,
  ) {
    super(`Node "${nodeId}" has unknown nodeKind "${kind}".`);
    this.name = "UnknownNodeKindError";
  }
}

/** A node id referenced in an edge doesn't exist in the node set. */
export class DanglingEdgeError extends Error {
  constructor(
    readonly edge: ExecEdge,
  ) {
    super(
      `Edge ${edge.source} → ${edge.target} references a node that doesn't exist.`,
    );
    this.name = "DanglingEdgeError";
  }
}

// ---------------------------------------------------------------------------
// Topological sort (Kahn's algorithm)
// ---------------------------------------------------------------------------

export interface TopoLevel {
  /** Node ids that can run in parallel at this depth. */
  nodeIds: string[];
}

/**
 * Group nodes into topological levels. All nodes within a level have no
 * dependency on each other and may run concurrently. Throws on cycles or
 * dangling edges.
 */
export function topoLevels(nodes: ExecNode[], edges: ExecEdge[]): TopoLevel[] {
  const ids = new Set(nodes.map((n) => n.id));

  // Validate edges reference real nodes.
  for (const e of edges) {
    if (!ids.has(e.source) || !ids.has(e.target)) {
      throw new DanglingEdgeError(e);
    }
  }

  // in-degree per node + adjacency (who does this node feed?).
  const indegree = new Map<string, number>();
  const downstream = new Map<string, string[]>();
  for (const n of nodes) {
    indegree.set(n.id, 0);
    downstream.set(n.id, []);
  }
  for (const e of edges) {
    indegree.set(e.target, (indegree.get(e.target) ?? 0) + 1);
    downstream.get(e.source)!.push(e.target);
  }

  // Seed with roots (in-degree 0). Preserve input order for determinism.
  let frontier = nodes.filter((n) => (indegree.get(n.id) ?? 0) === 0).map((n) => n.id);
  const levels: TopoLevel[] = [];
  let visited = 0;

  while (frontier.length > 0) {
    levels.push({ nodeIds: [...frontier] });
    visited += frontier.length;
    const next: string[] = [];
    for (const id of frontier) {
      for (const d of downstream.get(id) ?? []) {
        indegree.set(d, (indegree.get(d) ?? 0) - 1);
        if ((indegree.get(d) ?? 0) === 0) next.push(d);
      }
    }
    frontier = next;
  }

  if (visited !== nodes.length) {
    throw new CycleDetectedError();
  }
  return levels;
}

/** Flat execution order (levels flattened). Convenience for event reporting. */
export function executionOrder(nodes: ExecNode[], edges: ExecEdge[]): string[] {
  return topoLevels(nodes, edges).flatMap((l) => l.nodeIds);
}

// ---------------------------------------------------------------------------
// Execution
// ---------------------------------------------------------------------------

export interface ExecuteGraphOptions {
  getKey: NodeRunnerContext["getKey"];
  signal: AbortSignal;
  /** Called for every execution event. Callers persist + forward to renderer. */
  onEvent: (event: NodeExecutionEvent) => void;
}

/**
 * Execute a node-workflow graph.
 *
 * Returns the run result. The caller (IPC layer) owns run-id generation,
 * persistence, and pushing events to the renderer — the executor just runs
 * the graph and reports events.
 */
export async function executeGraph(
  nodes: ExecNode[],
  edges: ExecEdge[],
  runId: string,
  options: ExecuteGraphOptions,
): Promise<GraphRunResult> {
  const { getKey, signal, onEvent } = options;
  const outputs: Record<string, unknown> = {};
  const ordered = executionOrder(nodes, edges);

  onEvent({ type: "run:started", runId, orderedNodeIds: ordered });

  const levels = topoLevels(nodes, edges);
  for (const level of levels) {
    if (signal.aborted) break;

    // Run all nodes at this depth in parallel.
    await Promise.all(
      level.nodeIds.map((nodeId) =>
        runNode(nodeId, nodes, edges, outputs, { getKey, signal }, onEvent),
      ),
    );

    // If any node in this level failed, runNode already threw and we won't
    // reach here. Abort check is between levels.
  }

  if (signal.aborted) {
    onEvent({ type: "run:cancelled", runId });
    return { runId, status: "cancelled", outputs };
  }
  onEvent({ type: "run:completed", runId });
  return { runId, status: "completed", outputs };
}

/**
 * Run a single node: gather inputs, dispatch to its runner, store the output.
 * Throws on failure (the caller's fail-fast contract). AwaitReviewError is
 * re-thrown so the top-level loop can transition to awaiting-review.
 */
async function runNode(
  nodeId: string,
  nodes: ExecNode[],
  edges: ExecEdge[],
  outputs: Record<string, unknown>,
  ctx: NodeRunnerContext,
  onEvent: (event: NodeExecutionEvent) => void,
): Promise<void> {
  const node = nodes.find((n) => n.id === nodeId)!;
  const kind = (node.data.nodeKind ?? "pass-through") as NodeKind;

  // Validate the kind has a runner before announcing start.
  const runner = RUNNERS.get(kind);
  if (!runner) {
    onEvent({ type: "node:failed", nodeId, error: `Unknown nodeKind "${kind}".` });
    throw new UnknownNodeKindError(nodeId, String(kind));
  }

  // Gather inputs from upstream nodes.
  const input: Record<string, unknown> = {};
  for (const e of edges) {
    if (e.target === nodeId) {
      input[e.source] = outputs[e.source];
    }
  }

  onEvent({ type: "node:started", nodeId, nodeKind: kind });

  try {
    const output = await runner.run({
      config: (node.data.config ?? {}) as Record<string, unknown>,
      input,
      ctx,
    });
    outputs[nodeId] = output;
    onEvent({ type: "node:completed", nodeId, output });
  } catch (err) {
    if (err instanceof AwaitReviewError) {
      // Re-throw for the top-level handler — not a node failure.
      throw err;
    }
    const message = err instanceof Error ? err.message : String(err);
    onEvent({ type: "node:failed", nodeId, error: message });
    throw err;
  }
}

/**
 * Run a graph with review-gate handling at the top level.
 *
 * Wraps executeGraph: if any node throws AwaitReviewError, the run ends in
 * the `awaiting-review` state (not failed). This is the entrypoint the IPC
 * layer should call.
 */
export async function executeGraphWithReview(
  nodes: ExecNode[],
  edges: ExecEdge[],
  runId: string,
  options: ExecuteGraphOptions,
): Promise<GraphRunResult> {
  try {
    return await executeGraph(nodes, edges, runId, options);
  } catch (err) {
    if (err instanceof AwaitReviewError) {
      options.onEvent({ type: "run:completed", runId }); // review is a clean stop
      const status: GraphRunStatus = "awaiting-review";
      return {
        runId,
        status,
        outputs: {},
        error: err.message,
      };
    }
    // Any other error is a real failure — re-throw so the caller records it.
    throw err;
  }
}
