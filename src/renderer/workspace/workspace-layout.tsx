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
import { registerWorkspaceSwitchCommands } from "../command-palette/index.js";
import { panelRegistry } from "./registry.js";
import { loadLayout, saveLayout, defaultWorkspaceRoot, reconcile, findSlotNode, findPanelNode, wrapWithNewTab } from "./workspace-state.js";
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
  // Seed built-in workspace presets on first run, then refresh the palette's
  // per-workspace switch commands so every preset is reachable immediately.
  useEffect(() => {
    seedBuiltinWorkspaces(panelRegistry.all());
    registerWorkspaceSwitchCommands();
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

  // Toggle (collapse/expand) a region by canonical slot. Implemented as a
  // TOGGLE_REGION action that flips the `hidden` flag on the slot's first tab
  // group; the group keeps its panels and tree position so it restores losslessly.
  const toggleRegion = useCallback((slot: WorkspaceSlot) => {
    setRoot((prev) => layoutReducer(prev, { type: "TOGGLE_REGION", slot }));
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
      // A new workspace should appear in the palette immediately; re-register
      // the per-workspace switch commands so the user can switch back to it.
      registerWorkspaceSwitchCommands();
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
