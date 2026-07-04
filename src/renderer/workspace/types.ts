/**
 * Workspace types — the layout model the Docking Framework renders and the
 * Workspace System persists.
 *
 * The model is a recursive tree. A {@link SplitNode} divides its area along a
 * row or column into sized children; a {@link TabNode} is a leaf holding a
 * stack of panels shown as tabs. The whole tree is the `root` of a
 * {@link Workspace}, which is the unit users save, name, and switch between.
 */
import type { ComponentType } from "react";

/** The four canonical regions a panel can default to. */
export type WorkspaceSlot = "left" | "center" | "right" | "bottom";

export const WORKSPACE_SLOTS: readonly WorkspaceSlot[] = ["left", "center", "right", "bottom"] as const;

/** Props every panel component receives. Stable contract — do not break. */
export interface PanelProps {
  /** Whether this panel is the currently-visible tab in its group. */
  isActive: boolean;
}

/** A panel's registration entry. 30+ panels depend on this shape. */
export interface PanelDefinition {
  /** Stable id, e.g. `"ai-chat"`. */
  id: string;
  /** Human-readable label shown in the tab strip and command palette. */
  title: string;
  /** Emoji or short glyph shown in icon rails and menus. */
  icon: string;
  /** The React component implementing the panel. */
  component: ComponentType<PanelProps>;
  /** Where the panel appears by default when first added. */
  defaultSlot: WorkspaceSlot;
  /** Whether the panel is visible in the default layout. */
  defaultVisible: boolean;
}

// ---------------------------------------------------------------------------
// Layout tree
// ---------------------------------------------------------------------------

/** Split orientation. Row = side-by-side (horizontal); Column = stacked. */
export type SplitDirection = "row" | "column";

/**
 * A leaf node: a stack of panels rendered as a tab group, one visible at a
 * time. Exactly one of the canonical slots is tagged for default-placement
 * and icon-rail behavior.
 */
export interface TabNode {
  /** Unique node id within the tree. */
  id: string;
  type: "tab";
  /** The canonical slot this group represents (for icon-rail styling). */
  slot: WorkspaceSlot;
  /** Ordered panel ids; the active one is `panels[activeIndex]`. */
  panels: string[];
  /** Index into `panels` of the visible tab. */
  activeIndex: number;
}

/**
 * A branch node: divides its area into two or more children separated by
 * draggable splitters. `sizes` are normalized fractions (sum ≈ 1) and align
 * 1:1 with `children`.
 */
export interface SplitNode {
  /** Unique node id within the tree. */
  id: string;
  type: "split";
  /** Layout direction of the children. */
  direction: SplitDirection;
  /** Normalized sizes in the range (0, 1); aligns with `children`. */
  sizes: number[];
  /** Child nodes, laid out in `direction` order. */
  children: LayoutNode[];
}

/** Any node in the layout tree. */
export type LayoutNode = SplitNode | TabNode;

/** Type guard: is this node a split? */
export function isSplitNode(node: LayoutNode): node is SplitNode {
  return node.type === "split";
}

/** Type guard: is this node a tab group? */
export function isTabNode(node: LayoutNode): node is TabNode {
  return node.type === "tab";
}

// ---------------------------------------------------------------------------
// Workspace (named, saveable arrangement)
// ---------------------------------------------------------------------------

/** A saved arrangement of panels — the unit the Workspace System manages. */
export interface Workspace {
  /** Stable id (slug or uuid). */
  id: string;
  /** Display name, e.g. "Storyboarding". */
  name: string;
  /** The layout tree, or null for an empty workspace. */
  root: LayoutNode | null;
  /** Epoch milliseconds of the last edit. */
  updatedAt: number;
  /** True for the built-in presets that cannot be deleted. */
  builtin?: boolean;
}

// ---------------------------------------------------------------------------
// Legacy model (for one-time migration of the pre-docking localStorage blob)
// ---------------------------------------------------------------------------

/**
 * The pre-docking layout shape: a flat record of which panels sat in each of
 * the four fixed slots, plus the active panel per slot. Kept only so
 * {@link migrateLegacy} can translate it into a tree on first load.
 * @deprecated retained solely for migration; new code uses {@link Workspace}.
 */
export interface LegacyWorkspaceLayoutState {
  slots: Partial<Record<WorkspaceSlot, string[]>>;
  active: Partial<Record<WorkspaceSlot, string | null>>;
}
