/**
 * Workspace layout types.
 *
 * The workspace arranges panels into named slots. Each slot can hold
 * multiple panels as tabs; one panel is active per slot. Panels register
 * themselves into a registry; the layout renders from registry + state.
 */
import type { ComponentType } from "react";

/** Named positions in the workspace grid. */
export type WorkspaceSlot = "left" | "center" | "right" | "bottom";

export const WORKSPACE_SLOTS: readonly WorkspaceSlot[] = ["left", "center", "right", "bottom"];

/** Props passed to every panel component. */
export interface PanelProps {
  /** Mark the panel as active/focused (future expansion). */
  isActive: boolean;
}

/** Metadata describing a dockable panel. */
export interface PanelDefinition {
  /** Stable unique id, used for persistence. */
  readonly id: string;
  /** Human-readable label shown in tab and command palette. */
  readonly title: string;
  /** Short label for the sidebar icon strip. */
  readonly icon: string;
  /** The React component rendered when this panel is active. */
  readonly component: ComponentType<PanelProps>;
  /** Default slot this panel docks into. */
  readonly defaultSlot: WorkspaceSlot;
  /** Whether the panel is visible by default. */
  readonly defaultVisible: boolean;
}

/** Persisted layout state: which panels go in which slot and order. */
export interface WorkspaceLayoutState {
  /** Ordered list of panel ids per slot. */
  readonly slots: Record<WorkspaceSlot, string[]>;
  /** Active panel id per slot (null if slot is empty). */
  readonly active: Partial<Record<WorkspaceSlot, string | null>>;
}