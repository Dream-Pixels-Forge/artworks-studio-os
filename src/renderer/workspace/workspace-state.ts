/**
 * Workspace state — builds the default layout and persists/restores it.
 *
 * Layout is persisted to localStorage (renderer-side) since it is a
 * UI preference, not a production document. This keeps it independent
 * of the main-process settings service.
 */
import type { WorkspaceLayoutState, WorkspaceSlot } from "./types.js";
import { panelRegistry } from "./registry.js";

const STORAGE_KEY = "artworks:workspace-layout";

/** Build the default layout from registered panels. */
export function defaultLayout(): WorkspaceLayoutState {
  const slots: Record<WorkspaceSlot, string[]> = { left: [], center: [], right: [], bottom: [] };
  const active: Partial<Record<WorkspaceSlot, string | null>> = {};

  for (const panel of panelRegistry.all()) {
    slots[panel.defaultSlot].push(panel.id);
    if (panel.defaultVisible && !active[panel.defaultSlot]) {
      active[panel.defaultSlot] = panel.id;
    }
  }

  // If center has panels but none active, pick the first.
  if (slots.center.length > 0 && !active.center) {
    active.center = slots.center[0]!;
  }

  return { slots, active };
}

/** Load layout from localStorage, falling back to defaults. */
export function loadLayout(): WorkspaceLayoutState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultLayout();
    const parsed = JSON.parse(raw) as WorkspaceLayoutState;
    return reconcile(parsed);
  } catch {
    return defaultLayout();
  }
}

/** Persist the current layout. */
export function saveLayout(state: WorkspaceLayoutState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage may be full or disabled — non-fatal.
  }
}

/**
 * Reconcile a loaded layout against the current registry: drop panel ids
 * that no longer exist and append newly registered panels to their slot.
 */
function reconcile(loaded: WorkspaceLayoutState): WorkspaceLayoutState {
  const merged = defaultLayout();
  const seen = new Set<string>();

  for (const slot of Object.keys(loaded.slots) as WorkspaceSlot[]) {
    const valid = (loaded.slots[slot] ?? []).filter((id) => {
      if (!panelRegistry.has(id) || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
    merged.slots[slot] = valid;

    const activeId = loaded.active[slot];
    if (activeId && valid.includes(activeId)) {
      merged.active[slot] = activeId;
    }
  }

  // Append any registered panels not present in the loaded layout.
  for (const panel of panelRegistry.all()) {
    if (!seen.has(panel.id)) {
      merged.slots[panel.defaultSlot].push(panel.id);
    }
  }

  // Ensure each non-empty slot has an active panel.
  for (const slot of Object.keys(merged.slots) as WorkspaceSlot[]) {
    if (merged.slots[slot].length > 0 && !merged.active[slot]) {
      merged.active[slot] = merged.slots[slot][0]!;
    }
  }

  return merged;
}

/** Toggle a panel's visibility in the workspace. */
export function togglePanel(
  state: WorkspaceLayoutState,
  panelId: string,
): WorkspaceLayoutState {
  const def = panelRegistry.get(panelId);
  if (!def) return state;

  const slot = def.defaultSlot;
  const inSlot = state.slots[slot].includes(panelId);

  if (inSlot) {
    // Remove from slot.
    const remaining = state.slots[slot].filter((id) => id !== panelId);
    const wasActive = state.active[slot] === panelId;
    const newActive = wasActive ? (remaining[0] ?? null) : state.active[slot];
    return {
      slots: { ...state.slots, [slot]: remaining },
      active: { ...state.active, [slot]: newActive },
    };
  }

  // Add to slot.
  const added = [...state.slots[slot], panelId];
  return {
    slots: { ...state.slots, [slot]: added },
    active: { ...state.active, [slot]: state.active[slot] ?? panelId },
  };
}

/** Set the active panel for a slot. */
export function setActivePanel(
  state: WorkspaceLayoutState,
  slot: WorkspaceSlot,
  panelId: string,
): WorkspaceLayoutState {
  return { ...state, active: { ...state.active, [slot]: panelId } };
}