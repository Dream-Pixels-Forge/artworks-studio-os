/**
 * Workspace store — named, saveable panel arrangements (#5).
 *
 * Builds on the layout model in {@link workspace-state.ts}. A {@link Workspace}
 * is a named tree of panels; users switch between presets like "Storyboarding"
 * and "Editing", and can save the current arrangement under a custom name.
 *
 * Backed by `localStorage` (renderer-local), consistent with the pre-docking
 * design decision. A main-process IPC layer can be layered over later if
 * cross-machine sync is required.
 */
import type { PanelDefinition, TabNode, Workspace, WorkspaceSlot } from "./types.js";
import { defaultWorkspaceRoot } from "./workspace-state.js";

const STORAGE_KEY = "artworks:workspaces";
const ACTIVE_KEY = "artworks:active-workspace";

// ---------------------------------------------------------------------------
// Built-in presets
// ---------------------------------------------------------------------------

/**
 * Build the three built-in workspace presets from the registry. Each is a
 * curated arrangement of existing panels, matching the department workspaces
 * described in docs/ui-ux.md. Called the first time the store is seeded (no
 * saved workspaces yet) so there is always something sensible to show.
 */
export function buildBuiltinWorkspaces(registry: ReadonlyArray<PanelDefinition>): Workspace[] {
  const now = Date.now();
  const ids = new Set(registry.map((p) => p.id));
  const has = (id: string) => ids.has(id);
  // First defaultVisible center panel, falling back to welcome.
  const homePanel = registry.find((p) => p.defaultSlot === "center" && p.defaultVisible)?.id ?? "welcome";

  // --- "Storyboarding": explorer + home + assets, timeline on the bottom ---
  const storyboard: Workspace = {
    id: "builtin-storyboard",
    name: "Storyboarding",
    builtin: true,
    updatedAt: now,
    root: {
      id: "sb-root",
      type: "split",
      direction: "column",
      sizes: [0.72, 0.28],
      children: [
        {
          id: "sb-top",
          type: "split",
          direction: "row",
          sizes: [0.22, 0.5, 0.28],
          children: [
            tab("sb-left", "left", ["project-explorer"].filter(has)),
            tab("sb-center", "center", [homePanel]),
            tab("sb-right", "right", ["asset-browser"].filter(has)),
          ],
        },
        tab("sb-bottom", "bottom", ["timeline", "version-history"].filter(has)),
      ],
    },
  };

  // --- "Editing": explorer + home + properties, AI chat docked right ---
  const editing: Workspace = {
    id: "builtin-editing",
    name: "Editing",
    builtin: true,
    updatedAt: now,
    root: {
      id: "ed-root",
      type: "split",
      direction: "row",
      sizes: [0.22, 0.5, 0.28],
      children: [
        tab("ed-left", "left", ["project-explorer"].filter(has)),
        tab("ed-center", "center", [homePanel]),
        tab("ed-right", "right", ["ai-chat", "knowledge-graph"].filter(has)),
      ],
    },
  };

  // --- "Production": the full default arrangement ---
  const production: Workspace = {
    id: "builtin-production",
    name: "Production",
    builtin: true,
    updatedAt: now,
    root: defaultWorkspaceRoot(registry),
  };

  return [storyboard, editing, production];
}

/** Make a tab-group node helper for the preset builders. */
function tab(id: string, slot: WorkspaceSlot, panels: string[]): TabNode {
  return { id, type: "tab", slot, panels, activeIndex: 0 };
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

interface StoreShape {
  workspaces: Workspace[];
  activeId: string | null;
}

function readStore(): StoreShape {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { workspaces: [], activeId: null };
    const parsed = JSON.parse(raw) as Partial<StoreShape>;
    return {
      workspaces: Array.isArray(parsed.workspaces) ? (parsed.workspaces as Workspace[]) : [],
      activeId: typeof parsed.activeId === "string" ? parsed.activeId : null,
    };
  } catch {
    return { workspaces: [], activeId: null };
  }
}

function writeStore(s: StoreShape): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* storage full or unavailable — non-fatal for layout */
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** List all saved workspaces (built-ins + custom), ordered with built-ins first. */
export function listWorkspaces(): Workspace[] {
  return readStore().workspaces;
}

/** Get a workspace by id. */
export function getWorkspace(id: string): Workspace | null {
  return readStore().workspaces.find((w) => w.id === id) ?? null;
}

/** Get the active workspace id (or null if none chosen yet). */
export function getActiveWorkspaceId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_KEY);
  } catch {
    return null;
  }
}

/** Get the active workspace object. */
export function getActiveWorkspace(): Workspace | null {
  const id = getActiveWorkspaceId();
  return id ? getWorkspace(id) : null;
}

/**
 * Save (upsert) a workspace. If `workspace.id` matches an existing entry it
 * is replaced; otherwise it is appended. Built-ins can be overwritten by id
 * (e.g. when the registry grows and presets are re-seeded).
 */
export function saveWorkspace(workspace: Workspace): void {
  const s = readStore();
  const idx = s.workspaces.findIndex((w) => w.id === workspace.id);
  const next: Workspace = { ...workspace, updatedAt: Date.now() };
  if (idx >= 0) s.workspaces[idx] = next;
  else s.workspaces.push(next);
  writeStore(s);
}

/** Delete a workspace by id. Built-ins are protected (no-op). */
export function deleteWorkspace(id: string): void {
  const s = readStore();
  const target = s.workspaces.find((w) => w.id === id);
  if (!target || target.builtin) return;
  s.workspaces = s.workspaces.filter((w) => w.id !== id);
  if (s.activeId === id) s.activeId = null;
  writeStore(s);
  try {
    if (getActiveWorkspaceId() === id) localStorage.removeItem(ACTIVE_KEY);
  } catch {
    /* ignore */
  }
}

/** Set the active workspace id (persisted across restarts). */
export function setActiveWorkspace(id: string | null): void {
  try {
    if (id) localStorage.setItem(ACTIVE_KEY, id);
    else localStorage.removeItem(ACTIVE_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Seed the store with built-in presets if it is empty (first run, or the
 * localStorage blob was cleared). Returns true if seeding happened.
 */
export function seedBuiltinWorkspaces(registry: ReadonlyArray<PanelDefinition>): boolean {
  const s = readStore();
  if (s.workspaces.length > 0) return false;
  const builtins = buildBuiltinWorkspaces(registry);
  writeStore({ workspaces: builtins, activeId: builtins[0]?.id ?? null });
  if (builtins[0]) setActiveWorkspace(builtins[0].id);
  return true;
}

/** Clear all workspaces (tests use this for an isolated state). */
export function __clearWorkspaces(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(ACTIVE_KEY);
  } catch {
    /* ignore */
  }
}
