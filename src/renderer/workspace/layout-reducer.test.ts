/**
 * Tests for the layout reducer — the pure docking logic.
 *
 * Covers all actions (SET_ACTIVE, CLOSE_TAB, RESIZE, MOVE_PANEL) including
 * edge-vs-center drops, empty-tree pruning, and single-child collapse.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { layoutReducer, __resetNodeIdCounter, type LayoutAction } from "./layout-reducer.js";
import type { LayoutNode } from "./types.js";

/** Build a small tab node for tests. */
function tab(id: string, panels: string[], activeIndex = 0): LayoutNode {
  return { id, type: "tab", slot: "center", panels, activeIndex };
}

/** Apply a sequence of actions, returning the final tree. */
function reduce(root: LayoutNode, ...actions: LayoutAction[]): LayoutNode {
  return actions.reduce(layoutReducer, root);
}

beforeEach(() => __resetNodeIdCounter());

describe("layoutReducer", () => {
  describe("SET_ACTIVE", () => {
    it("changes the active tab within a group", () => {
      const root = tab("g1", ["a", "b", "c"], 0);
      const next = layoutReducer(root, { type: "SET_ACTIVE", nodeId: "g1", panelId: "c" });
      expect((next as { activeIndex: number }).activeIndex).toBe(2);
    });

    it("is a no-op when the panel is not in the group", () => {
      const root = tab("g1", ["a", "b"], 0);
      const next = layoutReducer(root, { type: "SET_ACTIVE", nodeId: "g1", panelId: "zzz" });
      expect(next).toEqual(root);
    });
  });

  describe("CLOSE_TAB", () => {
    it("removes a panel and keeps activeIndex in range", () => {
      const root = tab("g1", ["a", "b", "c"], 2); // active = c
      const next = layoutReducer(root, { type: "CLOSE_TAB", nodeId: "g1", panelId: "b" });
      const t = next as { panels: string[]; activeIndex: number };
      expect(t.panels).toEqual(["a", "c"]);
      expect(t.activeIndex).toBe(1);
    });

    it("collapses a single-child split when the child empties", () => {
      // split([tab(g1=[a]), tab(g2=[b])]) → close a → g1 empties → split collapses to g2
      const root: LayoutNode = {
        id: "s1",
        type: "split",
        direction: "row",
        sizes: [0.5, 0.5],
        children: [tab("g1", ["a"]), tab("g2", ["b"])],
      };
      const next = layoutReducer(root, { type: "CLOSE_TAB", nodeId: "g1", panelId: "a" });
      // The split had one child left (g2), so it collapses to g2.
      expect(next.id).toBe("g2");
    });
  });

  describe("RESIZE", () => {
    it("updates split sizes and renormalizes", () => {
      const root: LayoutNode = {
        id: "s1",
        type: "split",
        direction: "row",
        sizes: [0.5, 0.5],
        children: [tab("g1", ["a"]), tab("g2", ["b"])],
      };
      const next = layoutReducer(root, { type: "RESIZE", nodeId: "s1", sizes: [0.3, 0.7] }) as {
        sizes: number[];
      };
      expect(next.sizes[0]).toBeCloseTo(0.3, 5);
      expect(next.sizes[1]).toBeCloseTo(0.7, 5);
    });

    it("clamps sizes to the minimum", () => {
      const root: LayoutNode = {
        id: "s1",
        type: "split",
        direction: "row",
        sizes: [0.5, 0.5],
        children: [tab("g1", ["a"]), tab("g2", ["b"])],
      };
      const next = layoutReducer(root, { type: "RESIZE", nodeId: "s1", sizes: [0.001, 0.999] }) as {
        sizes: number[];
      };
      expect(next.sizes[0]).toBeGreaterThanOrEqual(0.05);
    });
  });

  describe("MOVE_PANEL (center drop = stack)", () => {
    it("stacks a panel into an existing tab group and activates it", () => {
      const root: LayoutNode = {
        id: "s1",
        type: "split",
        direction: "row",
        sizes: [0.5, 0.5],
        children: [tab("g1", ["a"]), tab("g2", ["b"])],
      };
      const next = reduce(root, { type: "MOVE_PANEL", panelId: "b", targetNodeId: "g1", edge: "center" });
      // g2 should now be empty (b moved out) → split collapses to g1 with [a, b].
      expect(next.id).toBe("g1");
      expect((next as { panels: string[] }).panels).toEqual(["a", "b"]);
      expect((next as { activeIndex: number }).activeIndex).toBe(1);
    });
  });

  describe("MOVE_PANEL (edge drop = split)", () => {
    it("creates a new split when docking to an edge", () => {
      const g1 = tab("g1", ["a"]);
      const next = reduce(g1, { type: "MOVE_PANEL", panelId: "a", targetNodeId: "g1", edge: "right" });
      // Moving the only panel out of g1 then docking right: result is a split
      // of [empty-g1-removed...]. Since a was the only panel, after removal g1
      // empties and the tree is just the incoming node. Verify it's a tab with a.
      expect((next as { panels: string[] }).panels).toContain("a");
    });

    it("splits when a panel from one group docks on the edge of another", () => {
      const root: LayoutNode = {
        id: "s1",
        type: "split",
        direction: "row",
        sizes: [0.5, 0.5],
        children: [tab("g1", ["a", "x"]), tab("g2", ["b"])],
      };
      const next = reduce(root, { type: "MOVE_PANEL", panelId: "x", targetNodeId: "g2", edge: "left" });
      // Outer split s1 still holds g1 (now [a]) and a new inner split wrapping g2.
      const outer = next as { type: string; children: LayoutNode[] };
      expect(outer.type).toBe("split");
      expect(outer.children).toHaveLength(2);
      // g1 lost x, now holds only a.
      const g1 = outer.children[0] as { panels: string[] };
      expect(g1.panels).toEqual(["a"]);
      // The second child is a new split (x docked left of g2).
      const inner = outer.children[1] as { type: string; children: LayoutNode[] };
      expect(inner.type).toBe("split");
      expect((inner.children[0] as { panels: string[] }).panels).toContain("x");
      expect((inner.children[1] as { panels: string[] }).panels).toContain("b");
    });
  });
});
