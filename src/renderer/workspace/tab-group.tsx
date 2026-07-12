/**
 * TabGroup — a stack of panels shown as tabs, one visible at a time (#6).
 *
 * Renders a tab strip from a {@link TabNode} and the active panel's component
 * below it. Tab headers are draggable (HTML5 DnD) so users can dock them onto
 * other regions; each tab has a close button. The active-tab state lives on
 * the node and is changed via `onAction`.
 */
import { useState, type DragEvent, type MouseEvent } from "react";
import type { DockEdge, LayoutAction } from "./layout-reducer.js";
import type { PanelDefinition, PanelProps, TabNode } from "./types.js";
import { PanelIcon } from "./icons.js";

export interface TabGroupProps {
  node: TabNode;
  /** Registry lookup for panel metadata (title/icon). */
  panelDef: (id: string) => PanelDefinition | undefined;
  /** Dispatch a layout action (SET_ACTIVE / CLOSE_TAB / drag-initiated MOVE). */
  onAction: (action: LayoutAction) => void;
  /** Begin a tab drag (records the dragged panel id for the drop target). */
  onDragStartPanel: (panelId: string) => void;
  /** Clear the in-flight drag state. */
  onDragEndPanel: () => void;
  /** Pop a panel out into its own window (the ⤢ button on each tab). */
  onDetach: (panelId: string) => void;
}

export function TabGroup({ node, panelDef, onAction, onDragStartPanel, onDragEndPanel, onDetach }: TabGroupProps) {
  const [dragOverEdge, setDragOverEdge] = useState<DockEdge | null>(null);

  // A toggled-hidden region renders only a slim placeholder bar; clicking it
  // restores the group. The node keeps its panels and tree position so
  // toggling back is lossless.
  if (node.hidden) {
    return (
      <div
        className={`tab-group tab-group--hidden tab-group--hidden-${node.slot}`}
        role="group"
        aria-label={`${node.slot} region (collapsed)`}
        onClick={() => onAction({ type: "TOGGLE_REGION", slot: node.slot })}
        title={`Show ${node.slot}`}
      >
        <span className="tab-group__restore" aria-hidden>＋</span>
      </div>
    );
  }

  const activePanelId = node.panels[node.activeIndex] ?? node.panels[0] ?? null;
  const activeDef = activePanelId ? panelDef(activePanelId) : undefined;

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    // Allow a drop and compute which edge the pointer is closest to.
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const rect = e.currentTarget.getBoundingClientRect();
    const edge = computeEdge(e.clientX, e.clientY, rect);
    setDragOverEdge(edge);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const panelId = e.dataTransfer.getData("text/artworks-panel");
    const edge = dragOverEdge ?? "center";
    setDragOverEdge(null);
    if (!panelId) return;
    // Dropping onto the active group's own tab strip docks into this node.
    onAction({ type: "MOVE_PANEL", panelId, targetNodeId: node.id, edge });
  };

  const closeTab = (e: MouseEvent, panelId: string) => {
    e.stopPropagation();
    onAction({ type: "CLOSE_TAB", nodeId: node.id, panelId });
  };

  const detachTab = (e: MouseEvent, panelId: string) => {
    // stopPropagation so the tab's own onClick (SET_ACTIVE) doesn't fire — the
    // panel is about to leave this group anyway.
    e.stopPropagation();
    onDetach(panelId);
  };

  const Panel = activeDef?.component;

  return (
    <div
      className={`tab-group ${dragOverEdge ? `tab-group--drop-${dragOverEdge}` : ""}`}
      onDragOver={handleDragOver}
      onDragLeave={() => setDragOverEdge(null)}
      onDrop={handleDrop}
    >
      <div className="tab-group__strip" role="tablist">
        {node.panels.map((panelId) => {
          const def = panelDef(panelId);
          const isActive = panelId === activePanelId;
          return (
            <div
              key={panelId}
              role="tab"
              aria-selected={isActive}
              className={`tab-group__tab ${isActive ? "tab-group__tab--active" : ""}`}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData("text/artworks-panel", panelId);
                e.dataTransfer.effectAllowed = "move";
                onDragStartPanel(panelId);
              }}
              onDragEnd={onDragEndPanel}
              onClick={() => onAction({ type: "SET_ACTIVE", nodeId: node.id, panelId })}
            >
              {def ? <PanelIcon panelId={panelId} className="tab-group__icon" size={14} /> : null}
              <span className="tab-group__label">{def?.title ?? panelId}</span>
              <button
                className="tab-group__detach"
                aria-label={`Detach ${def?.title ?? panelId} into window`}
                title="Detach into window"
                onClick={(e) => detachTab(e, panelId)}
              >
                ⤢
              </button>
              <button
                className="tab-group__close"
                aria-label={`Close ${def?.title ?? panelId}`}
                onClick={(e) => closeTab(e, panelId)}
              >
                ×
              </button>
            </div>
          );
        })}
      </div>
      <div className="tab-group__content">
        {Panel ? <Panel isActive /> : <div className="tab-group__empty">No panel</div>}
      </div>
    </div>
  );
}

/**
 * Compute which edge of a rect the pointer is over, for drop-zone affordances.
 * Center if it's in the middle ~60% band; otherwise the nearest edge.
 */
function computeEdge(clientX: number, clientY: number, rect: DOMRect): DockEdge {
  const x = (clientX - rect.left) / rect.width;
  const y = (clientY - rect.top) / rect.height;
  if (x > 0.35 && x < 0.65 && y > 0.35 && y < 0.65) return "center";
  // Nearest edge.
  const dLeft = x;
  const dRight = 1 - x;
  const dTop = y;
  const dBottom = 1 - y;
  const min = Math.min(dLeft, dRight, dTop, dBottom);
  if (min === dLeft) return "left";
  if (min === dRight) return "right";
  if (min === dTop) return "top";
  return "bottom";
}

// `PanelProps` is re-exported here only to keep the import used for the
// component contract; React consumes it via `activeDef.component`.
export type { PanelProps };
