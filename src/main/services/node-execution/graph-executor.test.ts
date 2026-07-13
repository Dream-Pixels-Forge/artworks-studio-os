/**
 * Graph executor tests.
 *
 * Pure logic tests — no DB, no React, no network. The text-generation
 * runner calls ai-gateway.complete(), so that path is mocked here.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  topoLevels,
  executionOrder,
  executeGraph,
  executeGraphWithReview,
  CycleDetectedError,
  DanglingEdgeError,
  type ExecNode,
  type ExecEdge,
} from "./graph-executor.js";
import { AwaitReviewError, RUNNERS, interpolate } from "./node-runners.js";
import { complete } from "@main/services/ai-gateway.js";
import type { NodeKind } from "@shared/production/node-types.js";

// Mock ai-gateway.complete so text-generation is testable without network.
vi.mock("@main/services/ai-gateway.js", () => ({
  complete: vi.fn(async () => ({ content: "mocked-llm-output", model: "test", provider: "openai", usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 } })),
}));

// Mock logger (pulled in transitively).
vi.mock("@main/core/logger.js", () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

const noAbort = new AbortController().signal;
const noop = () => {};
const ctx = (overrides: Partial<{ signal: AbortSignal; onEvent: () => void }> = {}) => ({
  getKey: () => "sk-test",
  signal: overrides.signal ?? noAbort,
  onEvent: overrides.onEvent ?? noop,
});

// ─── helpers ────────────────────────────────────────────────────────────────
function node(id: string, kind?: NodeKind, config?: Record<string, unknown>): ExecNode {
  return { id, data: { nodeKind: kind, config } };
}
function edge(source: string, target: string): ExecEdge {
  return { source, target };
}

// ─── topological sort ───────────────────────────────────────────────────────
describe("topoLevels", () => {
  it("returns a single level for disconnected nodes", () => {
    const levels = topoLevels([node("a"), node("b")], []);
    expect(levels).toHaveLength(1);
    expect(levels[0].nodeIds).toEqual(["a", "b"]);
  });

  it("orders a linear chain A → B → C", () => {
    const levels = topoLevels(
      [node("a"), node("b"), node("c")],
      [edge("a", "b"), edge("b", "c")],
    );
    expect(levels.map((l) => l.nodeIds)).toEqual([["a"], ["b"], ["c"]]);
  });

  it("puts independent nodes at the same level (parallelizable)", () => {
    // A → B, A → C  (B and C are independent → same level)
    const levels = topoLevels(
      [node("a"), node("b"), node("c")],
      [edge("a", "b"), edge("a", "c")],
    );
    expect(levels.map((l) => l.nodeIds)).toEqual([["a"], ["b", "c"]]);
  });

  it("preserves a diamond: A → {B,C} → D", () => {
    const levels = topoLevels(
      [node("a"), node("b"), node("c"), node("d")],
      [edge("a", "b"), edge("a", "c"), edge("b", "d"), edge("c", "d")],
    );
    expect(levels.map((l) => l.nodeIds)).toEqual([["a"], ["b", "c"], ["d"]]);
  });

  it("throws CycleDetectedError on a cycle", () => {
    expect(() =>
      topoLevels(
        [node("a"), node("b")],
        [edge("a", "b"), edge("b", "a")],
      ),
    ).toThrow(CycleDetectedError);
  });

  it("throws on a self-loop", () => {
    expect(() => topoLevels([node("a")], [edge("a", "a")])).toThrow(CycleDetectedError);
  });

  it("throws DanglingEdgeError when an edge references a missing node", () => {
    expect(() => topoLevels([node("a")], [edge("a", "ghost")])).toThrow(DanglingEdgeError);
  });
});

describe("executionOrder", () => {
  it("flattens levels into a linear order", () => {
    expect(
      executionOrder(
        [node("a"), node("b"), node("c")],
        [edge("a", "b"), edge("b", "c")],
      ),
    ).toEqual(["a", "b", "c"]);
  });
});

// ─── execution ──────────────────────────────────────────────────────────────
describe("executeGraph", () => {
  beforeEach(() => {
    vi.mocked(complete).mockClear();
  });

  it("runs a single pass-through node and emits run:completed", async () => {
    const events: string[] = [];
    const result = await executeGraph([node("a", "pass-through")], [], "run_1", {
      ...ctx({ onEvent: () => {} }),
      onEvent: (e) => events.push(e.type),
    });
    expect(result.status).toBe("completed");
    expect(events).toContain("run:started");
    expect(events).toContain("node:started");
    expect(events).toContain("node:completed");
    expect(events).toContain("run:completed");
  });

  it("feeds upstream output into a downstream text-generation node", async () => {
    // prompt-template (renders "hello") → text-generation (consumes it).
    const nodes = [
      node("p", "prompt-template", { prompt: "hello world" }),
      node("g", "text-generation", { prompt: "Refine: {{p.output}}" }),
    ];
    const events: { type: string; nodeId?: string; output?: unknown }[] = [];
    const result = await executeGraph(nodes, [edge("p", "g")], "run_2", {
      ...ctx(),
      onEvent: (e) => events.push({ type: e.type, nodeId: "nodeId" in e ? e.nodeId : undefined }),
    });
    expect(result.status).toBe("completed");
    // The text-generation node should have received "hello world" interpolated.
    const call = vi.mocked(complete).mock.calls[0][0];
    expect(call[call.length - 1].content).toBe("Refine: hello world");
    expect(result.outputs["g"]).toBe("mocked-llm-output");
  });

  it("fails the run when a stubbed media node is executed", async () => {
    const nodes = [node("img", "image-generation", { prompt: "a cat" })];
    const events: string[] = [];
    await expect(
      executeGraph(nodes, [], "run_3", {
        ...ctx(),
        onEvent: (e) => events.push(e.type),
      }),
    ).rejects.toThrow(/not yet implemented/);
    expect(events).toContain("node:failed");
  });

  it("respects signal.aborted between levels", async () => {
    const ctrl = new AbortController();
    // Two-level chain; abort before B runs.
    const nodes = [node("a", "pass-through"), node("b", "pass-through")];
    let ran: string[] = [];
    const result = await executeGraph(nodes, [edge("a", "b")], "run_4", {
      getKey: () => "sk-test",
      signal: ctrl.signal,
      onEvent: (e) => {
        if (e.type === "node:completed") ran.push(e.nodeId);
        if (e.type === "node:completed" && e.nodeId === "a") ctrl.abort();
      },
    });
    expect(result.status).toBe("cancelled");
    expect(ran).toEqual(["a"]); // b never ran
  });

  it("treats a node with no nodeKind as pass-through (legacy compat)", async () => {
    const legacy: ExecNode = { id: "old", data: {} }; // no nodeKind
    const result = await executeGraph([legacy], [], "run_5", ctx());
    expect(result.status).toBe("completed");
    expect(result.outputs["old"]).toEqual({}); // empty input forwarded
  });

  it("emits node:skipped-free happy path and reports orderedNodeIds", async () => {
    const start: { orderedNodeIds?: string[] } = {};
    await executeGraph(
      [node("a", "pass-through"), node("b", "pass-through")],
      [edge("a", "b")],
      "run_6",
      {
        ...ctx(),
        onEvent: (e) => {
          if (e.type === "run:started") start.orderedNodeIds = e.orderedNodeIds;
        },
      },
    );
    expect(start.orderedNodeIds).toEqual(["a", "b"]);
  });
});

// ─── review-gate handling ───────────────────────────────────────────────────
describe("executeGraphWithReview", () => {
  it("ends a run in awaiting-review when a review-gate is reached", async () => {
    // a (pass-through) → gate (review-gate)
    const nodes = [
      node("a", "pass-through"),
      node("gate", "review-gate", { prompt: "Please review the storyboard." }),
    ];
    const result = await executeGraphWithReview(nodes, [edge("a", "gate")], "run_g", ctx());
    expect(result.status).toBe("awaiting-review");
    expect(result.error).toContain("review");
  });
});

// ─── runner registry ────────────────────────────────────────────────────────
describe("RUNNERS registry", () => {
  it("has a runner for every NodeKind", () => {
    const kinds = [
      "text-generation",
      "prompt-template",
      "image-generation",
      "video-generation",
      "audio-generation",
      "voice-synthesis",
      "review-gate",
      "export",
      "pass-through",
    ] as const;
    for (const k of kinds) expect(RUNNERS.has(k)).toBe(true);
  });

  it("AwaitReviewError carries its node context", () => {
    const e = new AwaitReviewError("n1", "review needed");
    expect(e instanceof Error).toBe(true);
    expect(e.name).toBe("AwaitReviewError");
    expect(e.nodeId).toBe("n1");
  });
});

// ─── interpolation (exported from node-runners) ─────────────────────────────
describe("interpolate", () => {
  it("resolves {{nodeId.output}} and bare {{nodeId}}", () => {
    expect(interpolate("{{a.output}}", { a: "hi" })).toBe("hi");
    expect(interpolate("{{a}}", { a: "hi" })).toBe("hi");
    expect(interpolate("[{{x}}]", { x: { n: 1 } })).toBe('[{"n":1}]');
  });

  it("leaves unknown placeholders untouched", () => {
    expect(interpolate("{{missing}}", {})).toBe("{{missing}}");
  });
});
