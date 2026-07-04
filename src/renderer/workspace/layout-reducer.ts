/**
 * Layout reducer — pure functions that mutate the layout tree.
 *
 * Every docking interaction (move a panel, split a region, resize a splitter,
 * close a tab, switch the active tab) flows through {@link layoutReducer} as a
 * typed action. Keeping this pure (no React, no DOM) makes the docking logic
 * straightforward to unit-test and reason about.
 */
import type { LayoutNode, SplitNode, SplitDirection, TabNode, WorkspaceSlot } from "./types.js";
import { isSplitNode, isTabNode } from "./types.js";

/** Minimum normalized size for any pane — guards against collapse. */
export const MIN_PANE_SIZE = 0.05;

let nodeSeq = 0;
/** Generate a unique node id within a tree. */
function nodeId(prefix: string): string {
  nodeSeq += 1;
  return `${prefix}-${nodeSeq.toString(36)}`;
}

/** Reset the id counter (tests call this for deterministic ids). */
export function __resetNodeIdCounter(): void {
  nodeSeq = 0;
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

/** Set the visible tab of a specific tab group. */
export interface SetActiveAction {
  type: "SET_ACTIVE";
  /** Node id of the tab group to update. */
  nodeId: string;
  /** New active panel id within that group. */
  panelId: string;
}

/** Close a tab. If the group becomes empty it is pruned from the tree. */
export interface CloseTabAction {
  type: "CLOSE_TAB";
  /** Node id of the tab group. */
  nodeId: string;
  /** Panel id to remove. */
  panelId: string;
}

/** Edge to dock a dragged panel onto, relative to the target node. */
export type DockEdge = "left" | "right" | "top" | "bottom" | "center";

/** Move/dock a panel: stack (center) or split (edge) the target node. */
export interface MovePanelAction {
  type: "MOVE_PANEL";
  /** Panel id being moved. */
  panelId: string;
  /** Node id the panel is dropped onto. */
  targetNodeId: string;
  /** Where on the target the panel is dropped. */
  edge: DockEdge;
}

/** Resize a split's children via normalized fractions. */
export interface ResizeAction {
  type: "RESIZE";
  /** Node id of the split being resized. */
  nodeId: string;
  /** New normalized sizes (one per child, sum ≈ 1). */
  sizes: number[];
}

export type LayoutAction = SetActiveAction | CloseTabAction | MovePanelAction | ResizeAction;

// ---------------------------------------------------------------------------
// Small structural helpers
// ---------------------------------------------------------------------------

/** Deep-clone a node (JSON is safe — the tree is plain serializable data). */
function clone<T>(node: T): T {
  return JSON.parse(JSON.stringify(node)) as T;
}

/** Make a fresh tab group node holding a single panel. */
function makeTabNode(slot: WorkspaceSlot, panelId: string): TabNode {
  return { id: nodeId("tab"), type: "tab", slot, panels: [panelId], activeIndex: 0 };
}

/** Map a dock edge to a split direction. */
function edgeDirection(edge: DockEdge): SplitDirection {
  return edge === "left" || edge === "right" ? "row" : "column";
}

/** Which side of the new split the panel goes on. */
function edgeIsBefore(edge: DockEdge): boolean {
  return edge === "left" || edge === "top";
}

/**
 * Walk the tree, returning each node with its parent. The `enter` callback
 * may return a replacement node to rewrite that position.
 */
function walk(
  root: LayoutNode,
  enter: (node: LayoutNode, parent: SplitNode | null, indexInParent: number) => LayoutNode | void,
): LayoutNode {
  function visit(node: LayoutNode, parent: SplitNode | null, indexInParent: number): LayoutNode {
    const replaced = enter(node, parent, indexInParent);
    const current = replaced ?? node;
    if (isSplitNode(current)) {
      current.children = current.children.map((child, i) => visit(child, current, i));
    }
    return current;
  }
  return visit(root, null, 0);
}

/** Find a node by id. */
export function findNode(root: LayoutNode, id: string): LayoutNode | null {
  if (root.id === id) return root;
  if (isSplitNode(root)) {
    for (const child of root.children) {
      const found = findNode(child, id);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Prune empty tab groups, then collapse any split with a single child into
 * that child (so the tree never holds degenerate one-child splits). Returns
 * the cleaned node (or null if everything was removed).
 */
function pruneAndCollapse(node: LayoutNode): LayoutNode | null {
  // Recurse first.
  if (isSplitNode(node)) {
    const cleaned: LayoutNode[] = [];
    for (const child of node.children) {
      const c = pruneAndCollapse(child);
      if (c) cleaned.push(c);
    }
    if (cleaned.length === 0) return null;
    if (cleaned.length === 1) return cleaned[0]; // collapse
    node.children = cleaned;
    node.sizes = renormalize(node.sizes.slice(0, cleaned.length), cleaned.length);
    return node;
  }
  // Tab node: prune if it has no panels left.
  return node.panels.length === 0 ? null : node;
}

/** Produce `count` even fractions, ignoring the old sizes. */
function evenSizes(count: number): number[] {
  return Array.from({ length: count }, () => 1 / count);
}

/**
 * Clamp a sizes array so every entry is >= {@link MIN_PANE_SIZE} and the
 * total is 1. Panes below the floor are pinned to the floor; the remaining
 * budget (1 - floors) is shared among the others in proportion to their
 * original values. Guarantees the post-normalize values stay above the floor.
 */
function clampSizes(sizes: number[], count: number): number[] {
  if (sizes.length !== count) return evenSizes(count);
  const floored = sizes.map((s) => Math.max(MIN_PANE_SIZE, s));
  const floorSum = floored.length * MIN_PANE_SIZE;
  if (floorSum >= 1) return evenSizes(count); // too many panes to honor floors
  const overMin = floored.map((s) => s - MIN_PANE_SIZE);
  const overTotal = overMin.reduce((a, b) => a + b, 0) || 1;
  const budget = 1 - floorSum;
  return floored.map((_s, i) => MIN_PANE_SIZE + (overMin[i]! / overTotal) * budget);
}

/** Rescale an array to length `count`, padding/truncating with even shares. */
function renormalize(sizes: number[], count: number): number[] {
  if (sizes.length === count) {
    const sum = sizes.reduce((a, b) => a + b, 0) || 1;
    return sizes.map((s) => Math.max(MIN_PANE_SIZE, s / sum));
  }
  return evenSizes(count);
}

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

/**
 * Apply a layout action, returning a new tree. The input is never mutated.
 * Returns the original root if the action does not match any node.
 */
export function layoutReducer(root: LayoutNode, action: LayoutAction): LayoutNode {
  switch (action.type) {
    case "SET_ACTIVE":
      return walk(clone(root), (node) => {
        if (node.id === action.nodeId && isTabNode(node)) {
          const idx = node.panels.indexOf(action.panelId);
          if (idx >= 0) node.activeIndex = idx;
        }
      });

    case "CLOSE_TAB":
      return (
        pruneAndCollapse(
          walk(clone(root), (node) => {
            if (node.id === action.nodeId && isTabNode(node)) {
              const idx = node.panels.indexOf(action.panelId);
              if (idx >= 0) {
                node.panels.splice(idx, 1);
                // Keep activeIndex in range.
                if (node.activeIndex >= node.panels.length) {
                  node.activeIndex = Math.max(0, node.panels.length - 1);
                }
              }
            }
          }),
        ) ?? root
      );

    case "RESIZE":
      return walk(clone(root), (node) => {
        if (node.id === action.nodeId && isSplitNode(node)) {
          node.sizes = clampSizes(action.sizes.slice(0, node.children.length), node.children.length);
        }
      });

    case "MOVE_PANEL":
      return movePanel(clone(root), action);

    default:
      return root;
  }
}

/** Handle a MOVE_PANEL: first remove the panel from anywhere, then insert. */
function movePanel(root: LayoutNode, action: MovePanelAction): LayoutNode {
  // 1) Remove the panel from its current location across the whole tree.
  let tree = walk(root, (node) => {
    if (isTabNode(node) && node.panels.includes(action.panelId)) {
      const idx = node.panels.indexOf(action.panelId);
      node.panels.splice(idx, 1);
      if (node.activeIndex >= node.panels.length) {
        node.activeIndex = Math.max(0, node.panels.length - 1);
      }
    }
  });

  // 2) Prune empties/collapses so the target lookup is clean.
  const pruned = pruneAndCollapse(tree);
  if (!pruned) {
    // Whole tree emptied — the panel becomes the only node.
    return makeTabNode("center", action.panelId);
  }
  tree = pruned;

  // 3) Locate the target and dock.
  const target = findNode(tree, action.targetNodeId);
  if (!target) return tree;

  // Remove the target from its parent so we can graft cleanly.
  const { grafted, dockedNode } = dockIntoTarget(tree, target, action);
  void dockedNode;
  return grafted;
}

/**
 * Graft the dragged panel onto/next-to the target node, returning the new
 * root. `center` stacks into a tab group; edges create a new split.
 */
function dockIntoTarget(root: LayoutNode, target: LayoutNode, action: MovePanelAction): {
  grafted: LayoutNode;
  dockedNode: LayoutNode;
} {
  const incoming = makeTabNode(detectSlot(target), action.panelId);

  // Center drop: stack into (or onto) the target tab group.
  if (action.edge === "center") {
    if (isTabNode(target)) {
      // Add to the existing group and activate.
      const merged: LayoutNode = walk(root, (node) => {
        if (node.id === target.id && isTabNode(node)) {
          node.panels.push(action.panelId);
          node.activeIndex = node.panels.length - 1;
        }
      });
      return { grafted: merged, dockedNode: target };
    }
    // Target is a split — dock into its first tab-group descendant.
    const firstTab = firstTabDescendant(target);
    if (firstTab) {
      const merged: LayoutNode = walk(root, (node) => {
        if (node.id === firstTab.id && isTabNode(node)) {
          node.panels.push(action.panelId);
          node.activeIndex = node.panels.length - 1;
        }
      });
      return { grafted: merged, dockedNode: firstTab };
    }
  }

  // Edge drop: wrap [target, incoming] (or [incoming, target]) in a split.
  const split: SplitNode = {
    id: nodeId("split"),
    type: "split",
    direction: edgeDirection(action.edge),
    sizes: [0.5, 0.5],
    children: edgeIsBefore(action.edge) ? [incoming, target] : [target, incoming],
  };
  const replaced = replaceNode(root, target.id, split);
  return { grafted: replaced, dockedNode: split };
}

/** Best-effort slot tag for a newly created node based on its tree position. */
function detectSlot(node: LayoutNode): WorkspaceSlot {
  if (isTabNode(node)) return node.slot;
  const tab = firstTabDescendant(node);
  return tab?.slot ?? "center";
}

/** Replace the node with id `targetId` by `replacement`, returning the root. */
function replaceNode(root: LayoutNode, targetId: string, replacement: LayoutNode): LayoutNode {
  if (root.id === targetId) return replacement;
  // Direct structural replace without re-walking into grafted subtrees
  // (walk would recurse into the replacement, which contains the target as a
  // child, and loop forever).
  if (isSplitNode(root)) {
    root.children = root.children.map((c) => (c.id === targetId ? clone(replacement) : replaceNode(c, targetId, replacement)));
  }
  return root;
}

/** First tab-group descendant (depth-first), or null. */
function firstTabDescendant(node: LayoutNode): TabNode | null {
  if (isTabNode(node)) return node;
  for (const child of node.children) {
    const t = firstTabDescendant(child);
    if (t) return t;
  }
  return null;
}
