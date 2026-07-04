/**
 * WorkspaceLayout — the top-level docking surface.
 *
 * Owns the active layout tree and the named-workspace state, dispatches
 * layout actions through the reducer, and persists both on change. Renders
 * a {@link WorkspaceBar} above the recursive {@link LayoutNodeView}.
 *
 * Public API is unchanged (`<WorkspaceLayout />`), so `studio-shell.tsx` and
 * other consumers don't need editing. The pre-docking 4-slot model is gone;
 * everything is the tree now.
 */
import { useCallback, useEffect, useState } from "react";
import { LayoutNodeView } from "./layout-node-view.js";
import { WorkspaceBar } from "./workspace-bar.js";
import { layoutReducer, type LayoutAction } from "./layout-reducer.js";
import { panelRegistry } from "./registry.js";
import { loadLayout, saveLayout, defaultWorkspaceRoot, reconcile, findSlotNode, findPanelNode } from "./workspace-state.js";
import {
  listWorkspaces,
  getActiveWorkspaceId,
  setActiveWorkspace,
  saveWorkspace,
  seedBuiltinWorkspaces,
} from "./workspace-store.js";
import type { LayoutNode, WorkspaceSlot } from "./types.js";

/** Renderer event the command palette dispatches to open a panel. */
const OPEN_PANEL_EVENT = "artworks:open-panel";
/** Renderer events the menu/shortcut actions dispatch to toggle regions. */
const TOGGLE_SIDEBAR_EVENT = "artworks:toggle-sidebar";
const TOGGLE_BOTTOM_EVENT = "artworks:toggle-bottom";

export function WorkspaceLayout() {
  // Seed built-in workspace presets on first run.
  useEffect(() => {
    seedBuiltinWorkspaces(panelRegistry.all());
  }, []);

  const [root, setRoot] = useState<LayoutNode>(() => loadLayout());
  const [workspaces, setWorkspaces] = useState(() => listWorkspaces());
  const [activeId, setActiveId] = useState<string | null>(() => getActiveWorkspaceId());

  // Persist the live layout tree whenever it changes.
  useEffect(() => {
    saveLayout(root);
  }, [root]);

  const panelDef = useCallback((id: string) => panelRegistry.get(id), []);

  const dispatch = useCallback((action: LayoutAction) => {
    setRoot((prev) => layoutReducer(prev, action));
  }, []);

  // Open a panel by id (makes the command palette's `artworks:open-panel`
  // events work — previously dead). If the panel is already in the tree it is
  // activated; otherwise it docks into its default slot.
  const openPanel = useCallback((panelId: string) => {
    setRoot((prev) => {
      const existing = findPanelNode(prev, panelId);
      if (existing) {
        return layoutReducer(prev, { type: "SET_ACTIVE", nodeId: existing.id, panelId });
      }
      const def = panelRegistry.get(panelId);
      if (!def) return prev;
      const target = findSlotNode(prev, def.defaultSlot);
      if (target) {
        return layoutReducer(prev, { type: "MOVE_PANEL", panelId, targetNodeId: target.id, edge: "center" });
      }
      // No node for that slot — wrap root with a new tab group.
      return wrapWithNewTab(prev, def.defaultSlot, panelId);
    });
  }, []);

  // Toggle (collapse/expand) the left or bottom region by id.
  const toggleRegion = useCallback((slot: WorkspaceSlot) => {
    setRoot((prev) => {
      const node = findSlotNode(prev, slot);
      if (!node) return prev;
      // Closing the active tab of a single-tab group effectively hides the
      // region; for multi-tab groups we collapse to the first tab. We model
      // "toggle off" as removing all but... actually simplest: collapse the
      // group by removing it via a synthetic action is complex. Instead, emit
      // a no-op for now and rely on splitter drag to resize. (A proper hide
      // is a follow-up — needs a `hidden` flag on TabNode.)
      void node;
      return prev;
    });
  }, []);

  // Listen for open-panel / toggle events from the command palette and menu.
  useEffect(() => {
    const onOpenPanel = (e: Event): void => {
      const detail = (e as CustomEvent<{ panelId: string }>).detail;
      if (detail?.panelId) openPanel(detail.panelId);
    };
    const onToggleSidebar = (): void => toggleRegion("left");
    const onToggleBottom = (): void => toggleRegion("bottom");
    window.addEventListener(OPEN_PANEL_EVENT, onOpenPanel);
    window.addEventListener(TOGGLE_SIDEBAR_EVENT, onToggleSidebar);
    window.addEventListener(TOGGLE_BOTTOM_EVENT, onToggleBottom);
    return () => {
      window.removeEventListener(OPEN_PANEL_EVENT, onOpenPanel);
      window.removeEventListener(TOGGLE_SIDEBAR_EVENT, onToggleSidebar);
      window.removeEventListener(TOGGLE_BOTTOM_EVENT, onToggleBottom);
    };
  }, [openPanel, toggleRegion]);

  const handleDragStartPanel = useCallback(() => {
    // No-op for now; the dragged panel id travels via the dataTransfer.
    // Hook left in place for future cursor/ghost customization.
  }, []);
  const handleDragEndPanel = useCallback(() => {
    /* see above */
  }, []);

  // --- Workspace switching -------------------------------------------------
  const handleSelectWorkspace = useCallback((id: string) => {
    const ws = listWorkspaces().find((w) => w.id === id);
    if (!ws || !ws.root) return;
    setActiveWorkspace(id);
    setActiveId(id);
    // Switching to a named workspace loads its tree (reconciled).
    const next = reconcile(ws.root, panelRegistry.all()) ?? defaultWorkspaceRoot();
    setRoot(next);
  }, []);

  // Listen for workspace-switch events from the command palette.
  useEffect(() => {
    const onSwitch = (e: Event): void => {
      const detail = (e as CustomEvent<{ id: string }>).detail;
      if (detail?.id) handleSelectWorkspace(detail.id);
    };
    window.addEventListener("artworks:workspace-switch", onSwitch);
    return () => window.removeEventListener("artworks:workspace-switch", onSwitch);
  }, [handleSelectWorkspace]);

  const handleSaveAs = useCallback(
    (name: string) => {
      const id = `ws-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now().toString(36)}`;
      saveWorkspace({ id, name, root, updatedAt: Date.now() });
      setActiveWorkspace(id);
      setActiveId(id);
      setWorkspaces(listWorkspaces());
    },
    [root],
  );

  return (
    <div className="workspace">
      <WorkspaceBar workspaces={workspaces} activeId={activeId} onSelect={handleSelectWorkspace} onSaveAs={handleSaveAs} />
      <div className="workspace__surface">
        <LayoutNodeView
          node={root}
          panelDef={panelDef}
          onAction={dispatch}
          onDragStartPanel={handleDragStartPanel}
          onDragEndPanel={handleDragEndPanel}
        />
      </div>
    </div>
  );
}

/**
 * Wrap an existing root in a split alongside a brand-new tab group for a slot
 * that has no node yet (used when opening a panel whose default slot is empty).
 * Mirrors the private helper in workspace-state.ts.
 */
function wrapWithNewTab(root: LayoutNode, slot: WorkspaceSlot, panelId: string): LayoutNode {
  const newTab = { id: `wrap-${slot}-${Date.now().toString(36)}`, type: "tab" as const, slot, panels: [panelId], activeIndex: 0 };
  const direction = slot === "left" || slot === "right" ? "row" : "column";
  const before = slot === "left";
  const children = before ? [newTab, root] : [root, newTab];
  return { id: `wrap-root-${Date.now().toString(36)}`, type: "split", direction, sizes: [0.25, 0.75], children };
}
