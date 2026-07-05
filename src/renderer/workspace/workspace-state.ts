/**
 * Workspace state — the layout model the Docking Framework renders and the
 * Workspace System persists (#5).
 *
 * This module owns:
 *  - {@link defaultWorkspaceRoot}: the default panel arrangement, derived
 *    from the panel registry (same shape users see today).
 *  - {@link reconcile}: drop dead panel ids + append newly-registered panels.
 *  - {@link migrateLegacy}: translate the pre-docking localStorage blob
 *    (`{slots, active}`) into the tree so existing users keep their layout.
 *  - {@link loadLayout} / {@link saveLayout}: persistence for the *active*
 *    working layout (separate from named-workspace presets).
 */
import type {
  LayoutNode,
  LegacyWorkspaceLayoutState,
  PanelDefinition,
  SplitNode,
  TabNode,
  Workspace,
  WorkspaceSlot,
} from "./types.js";
import { isSplitNode, isTabNode, WORKSPACE_SLOTS } from "./types.js";
import { panelRegistry } from "./registry.js";
import { layoutReducer, MIN_PANE_SIZE } from "./layout-reducer.js";

const ACTIVE_LAYOUT_KEY = "artworks:workspace-layout";

// ---------------------------------------------------------------------------
// Default layout
// ---------------------------------------------------------------------------

/**
 * The default layout tree, derived from the panel registry. Preserves the
 * pre-docking 4-slot arrangement: a column of [left|center|right row-split]
 * with an optional bottom strip. Empty regions are omitted from the tree.
 */
export function defaultWorkspaceRoot(registry: ReadonlyArray<PanelDefinition> = panelRegistry.all()): LayoutNode {
  const bySlot = binBySlot(registry);
  const topChildren: LayoutNode[] = [];
  const topSizes: number[] = [];

  // Left column (icon rail) — only the defaultVisible left panels.
  const leftVisible = bySlot.left.filter((p) => p.defaultVisible);
  // Center: defaultVisible center panels, else a fallback to the first center
  // panel or "welcome" so there is always something to show.
  const centerVisible = bySlot.center.filter((p) => p.defaultVisible);
  const centerIds = (centerVisible.length ? centerVisible : bySlot.center.length ? [bySlot.center[0]!] : []).map((p) => p.id);
  const centerFallback = centerIds.length ? centerIds : ["welcome"];
  // Right column.
  const rightVisible = bySlot.right.filter((p) => p.defaultVisible);

  if (leftVisible.length) {
    topChildren.push(tabNode("default-left", "left", leftVisible.map((p) => p.id)));
    topSizes.push(0.22);
  }
  topChildren.push(tabNode("default-center", "center", centerFallback));
  topSizes.push(leftVisible.length ? (rightVisible.length ? 0.5 : 0.78) : rightVisible.length ? 0.72 : 1);
  if (rightVisible.length) {
    topChildren.push(tabNode("default-right", "right", rightVisible.map((p) => p.id)));
    topSizes.push(0.28);
  }

  const top: LayoutNode =
    topChildren.length === 1
      ? topChildren[0]!
      : splitNode("default-top-row", "row", topSizes, topChildren);

  // Bottom strip — defaultVisible bottom panels.
  const bottomVisible = bySlot.bottom.filter((p) => p.defaultVisible);
  if (!bottomVisible.length) return top;

  return splitNode("default-root", "column", [0.74, 0.26], [
    top,
    tabNode("default-bottom", "bottom", bottomVisible.map((p) => p.id)),
  ]);
}

/** The default workspace object (id "default", name "Default"). */
export function defaultWorkspace(): Workspace {
  return {
    id: "default",
    name: "Default",
    root: defaultWorkspaceRoot(),
    updatedAt: Date.now(),
    builtin: true,
  };
}

// ---------------------------------------------------------------------------
// Reconciliation — keep a saved tree valid as the registry changes
// ---------------------------------------------------------------------------

/**
 * Walk a layout tree, dropping panel ids that are no longer registered and
 * deduping any that appear more than once. Prunes empty tab groups and
 * collapses degenerate one-child splits. Returns null if the whole tree
 * empties out (caller falls back to the default).
 */
export function reconcile(root: LayoutNode, registry: ReadonlyArray<PanelDefinition>): LayoutNode | null {
  const validIds = new Set(registry.map((p) => p.id));
  const seen = new Set<string>();

  function visit(node: LayoutNode): LayoutNode | null {
    if (isTabNode(node)) {
      // Drop unregistered ids and duplicates (a panel can only be in one place).
      const kept: string[] = [];
      for (const id of node.panels) {
        if (validIds.has(id) && !seen.has(id)) {
          kept.push(id);
          seen.add(id);
        }
      }
      if (kept.length === 0) return null;
      const cleaned: TabNode = { ...node, panels: kept, activeIndex: Math.min(node.activeIndex, kept.length - 1) };
      return cleaned;
    }
    // Split: recurse, prune, collapse.
    const kids: LayoutNode[] = [];
    for (const c of node.children) {
      const v = visit(c);
      if (v) kids.push(v);
    }
    if (kids.length === 0) return null;
    if (kids.length === 1) return kids[0]!;
    return { ...node, children: kids, sizes: renormalize(node.sizes, kids.length) };
  }

  return visit(root);
}

// ---------------------------------------------------------------------------
// Legacy migration — translate the pre-docking localStorage blob into a tree
// ---------------------------------------------------------------------------

/**
 * Migrate the legacy flat layout (`{slots, active}`) into a layout tree so
 * existing users keep their arrangement when upgrading to the docking system.
 * Returns null if `legacy` is null/empty/unparseable (caller uses the default).
 */
export function migrateLegacy(legacy: LegacyWorkspaceLayoutState | null): LayoutNode | null {
  if (!legacy || !legacy.slots) return null;
  const hasAny = WORKSPACE_SLOTS.some((s) => (legacy.slots[s]?.length ?? 0) > 0);
  if (!hasAny) return null;

  const topChildren: LayoutNode[] = [];
  const topSizes: number[] = [];
  const leftIds = legacy.slots.left ?? [];
  const centerIds = legacy.slots.center ?? [];
  const rightIds = legacy.slots.right ?? [];
  const bottomIds = legacy.slots.bottom ?? [];

  const activeIn = (s: WorkspaceSlot): string | null => {
    const a = legacy.active[s];
    return typeof a === "string" ? a : null;
  };

  if (leftIds.length) {
    topChildren.push(tabNode("mig-left", "left", leftIds, activeIn("left")));
    topSizes.push(0.22);
  }
  if (centerIds.length) {
    topChildren.push(tabNode("mig-center", "center", centerIds, activeIn("center")));
    topSizes.push(leftIds.length ? (rightIds.length ? 0.5 : 0.78) : rightIds.length ? 0.72 : 1);
  }
  if (rightIds.length) {
    topChildren.push(tabNode("mig-right", "right", rightIds, activeIn("right")));
    topSizes.push(0.28);
  }

  if (topChildren.length === 0) {
    // Only bottom panels existed — return a single bottom node.
    return tabNode("mig-bottom", "bottom", bottomIds, activeIn("bottom"));
  }

  const top: LayoutNode =
    topChildren.length === 1 ? topChildren[0]! : splitNode("mig-top", "row", topSizes, topChildren);

  if (!bottomIds.length) return top;
  return splitNode("mig-root", "column", [0.74, 0.26], [
    top,
    tabNode("mig-bottom", "bottom", bottomIds, activeIn("bottom")),
  ]);
}

// ---------------------------------------------------------------------------
// Persistence — the active working layout (live edits, not named presets)
// ---------------------------------------------------------------------------

/**
 * Load the active layout. Migration path: try the new tree shape first; if
 * absent, attempt legacy migration from the old `{slots, active}` blob; if
 * that fails too, fall back to the default. The returned tree is always
 * reconciled against the current registry.
 */
export function loadLayout(registry: ReadonlyArray<PanelDefinition> = panelRegistry.all()): LayoutNode {
  try {
    const raw = localStorage.getItem(ACTIVE_LAYOUT_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        // New shape: a layout tree.
        if (isLayoutNode(parsed)) {
          return reconcile(parsed as LayoutNode, registry) ?? defaultWorkspaceRoot(registry);
        }
        // Legacy shape: { slots, active }.
        if (parsed.slots) {
          const migrated = migrateLegacy(parsed as LegacyWorkspaceLayoutState);
          if (migrated) return reconcile(migrated, registry) ?? defaultWorkspaceRoot(registry);
        }
      }
    }
  } catch {
    /* fall through to default */
  }
  return defaultWorkspaceRoot(registry);
}

/** Persist the active layout tree. */
export function saveLayout(root: LayoutNode): void {
  try {
    localStorage.setItem(ACTIVE_LAYOUT_KEY, JSON.stringify(root));
  } catch {
    /* storage unavailable — non-fatal */
  }
}

// ---------------------------------------------------------------------------
// Helpers (also used by workspace-store.ts)
// ---------------------------------------------------------------------------

/** Bin panels by their default slot. */
function binBySlot(registry: ReadonlyArray<PanelDefinition>): Record<WorkspaceSlot, PanelDefinition[]> {
  const out: Record<WorkspaceSlot, PanelDefinition[]> = { left: [], center: [], right: [], bottom: [] };
  for (const p of registry) out[p.defaultSlot].push(p);
  return out;
}

/** Build a tab node, optionally with a specific active panel. */
function tabNode(id: string, slot: WorkspaceSlot, panels: string[], activeId?: string | null): TabNode {
  const activeIndex = activeId ? Math.max(0, panels.indexOf(activeId)) : 0;
  return { id, type: "tab", slot, panels, activeIndex };
}

/** Build a split node, normalizing sizes. */
function splitNode(id: string, direction: SplitNode["direction"], sizes: number[], children: LayoutNode[]): SplitNode {
  return { id, type: "split", direction, sizes: renormalize(sizes, children.length), children };
}

/** Rescale to `count` entries (pad/truncate with even shares), each >= floor. */
function renormalize(sizes: number[], count: number): number[] {
  if (sizes.length === count) {
    const sum = sizes.reduce((a, b) => a + b, 0) || 1;
    return sizes.map((s) => Math.max(MIN_PANE_SIZE, s / sum));
  }
  return Array.from({ length: count }, () => 1 / count);
}

/** Runtime check: does this object look like a layout node? */
function isLayoutNode(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return false;
  const t = (value as { type?: unknown }).type;
  return t === "tab" || t === "split";
}

// ---------------------------------------------------------------------------
// Backward-compatible helpers (kept so existing call sites keep working)
// ---------------------------------------------------------------------------

/**
 * Toggle a panel's presence in the layout: if absent, add it to its default
 * slot; if present, remove it. Returns the new tree. (Replaces the old flat
 * `togglePanel(state, panelId)` which operated on the legacy shape.)
 */
export function togglePanel(root: LayoutNode, panelId: string, registry: ReadonlyArray<PanelDefinition> = panelRegistry.all()): LayoutNode {
  // If it's already somewhere, remove it (CLOSE_TAB semantics).
  const existing = findPanelNode(root, panelId);
  if (existing) {
    return layoutReducer(root, { type: "CLOSE_TAB", nodeId: existing.id, panelId });
  }
  // Otherwise add it to its default slot: find or create a tab group there.
  const def = registry.find((p) => p.id === panelId);
  if (!def) return root;
  const target = findSlotNode(root, def.defaultSlot);
  if (target) {
    return layoutReducer(root, { type: "MOVE_PANEL", panelId, targetNodeId: target.id, edge: "center" });
  }
  // No node for that slot yet — wrap root in a split with a new group.
  return wrapWithNewTab(root, def.defaultSlot, panelId);
}

/**
 * Set the active panel within its tab group (no-op if not found).
 * Backward-compatible replacement for the old `setActivePanel`.
 */
export function setActivePanel(root: LayoutNode, panelId: string): LayoutNode {
  const node = findPanelNode(root, panelId);
  if (!node) return root;
  return layoutReducer(root, { type: "SET_ACTIVE", nodeId: node.id, panelId });
}

/** Find the tab node that currently holds a panel id. */
export function findPanelNode(root: LayoutNode, panelId: string): TabNode | null {
  if (isTabNode(root) && root.panels.includes(panelId)) return root;
  if (isSplitNode(root)) {
    for (const c of root.children) {
      const f = findPanelNode(c, panelId);
      if (f) return f;
    }
  }
  return null;
}

/** Find the first tab node tagged with a given slot. */
export function findSlotNode(root: LayoutNode, slot: WorkspaceSlot): TabNode | null {
  if (isTabNode(root)) return root.slot === slot ? root : null;
  if (isSplitNode(root)) {
    for (const c of root.children) {
      const f = findSlotNode(c, slot);
      if (f) return f;
    }
  }
  return null;
}

/** Wrap an existing root in a split alongside a brand-new tab group. */
export function wrapWithNewTab(root: LayoutNode, slot: WorkspaceSlot, panelId: string): LayoutNode {
  const newTab: TabNode = { id: `wrap-${slot}-${Date.now().toString(36)}`, type: "tab", slot, panels: [panelId], activeIndex: 0 };
  // Dock the new tab to the left/top of the existing root.
  const direction = slot === "left" || slot === "right" ? "row" : "column";
  // Left and bottom dock before the existing content; right docks after.
  // (There is no "top" slot — bottom is stacked below, i.e. after in column.)
  const before = slot === "left";
  const children = before ? [newTab, root] : [root, newTab];
  return { id: `wrap-root-${Date.now().toString(36)}`, type: "split", direction, sizes: [0.25, 0.75], children };
}

// Re-export legacy type alias so old imports keep compiling.
export type WorkspaceLayoutState = LegacyWorkspaceLayoutState;
