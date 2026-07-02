/**
 * WorkspaceLayout — renders registered panels into dockable slots.
 *
 * The layout reads from the panel registry + persisted layout state.
 * Each slot renders a tab bar (if more than one panel) and the active
 * panel's component. Slots with zero visible panels collapse to nothing.
 */
import { useCallback, useEffect, useState } from "react";
import type { WorkspaceLayoutState, WorkspaceSlot } from "./types.js";
import { panelRegistry } from "./registry.js";
import { loadLayout, saveLayout, setActivePanel } from "./workspace-state.js";

export function WorkspaceLayout() {
  const [state, setState] = useState<WorkspaceLayoutState>(() => loadLayout());

  useEffect(() => {
    saveLayout(state);
  }, [state]);

  const handleActivate = useCallback((slot: WorkspaceSlot, panelId: string) => {
    setState((prev) => setActivePanel(prev, slot, panelId));
  }, []);

  const leftPanels = state.slots.left.filter((id) => panelRegistry.has(id));
  const centerPanels = state.slots.center.filter((id) => panelRegistry.has(id));
  const rightPanels = state.slots.right.filter((id) => panelRegistry.has(id));
  const bottomPanels = state.slots.bottom.filter((id) => panelRegistry.has(id));

  const activeLeft = leftPanels.includes(state.active.left ?? "") ? state.active.left : leftPanels[0];
  const activeCenter = centerPanels.includes(state.active.center ?? "") ? state.active.center : centerPanels[0];
  const activeRight = rightPanels.includes(state.active.right ?? "") ? state.active.right : rightPanels[0];
  const activeBottom = bottomPanels.includes(state.active.bottom ?? "") ? state.active.bottom : bottomPanels[0];

  return (
    <div className="workspace">
      {leftPanels.length > 0 && (
        <aside className="workspace__sidebar workspace__sidebar--left">
          <div className="workspace__rail">
            {leftPanels.map((id) => {
              const p = panelRegistry.get(id)!;
              const isActive = id === activeLeft;
              return (
                <button
                  key={id}
                  className={`workspace__rail-btn${isActive ? " workspace__rail-btn--active" : ""}`}
                  title={p.title}
                  onClick={() => handleActivate("left", id)}
                >
                  {p.icon}
                </button>
              );
            })}
          </div>
          {activeLeft && (
            <div className="workspace__panel-content">
              {renderPanel(activeLeft, true)}
            </div>
          )}
        </aside>
      )}

      <div className="workspace__main">
        <div className="workspace__center">
          {centerPanels.length > 1 && (
            <div className="workspace__tabs">
              {centerPanels.map((id) => {
                const p = panelRegistry.get(id)!;
                const isActive = id === activeCenter;
                return (
                  <button
                    key={id}
                    className={`workspace__tab${isActive ? " workspace__tab--active" : ""}`}
                    onClick={() => handleActivate("center", id)}
                  >
                    {p.title}
                  </button>
                );
              })}
            </div>
          )}
          <div className="workspace__center-content">
            {activeCenter ? renderPanel(activeCenter, true) : <EmptyWorkspace />}
          </div>
        </div>

        {bottomPanels.length > 0 && activeBottom && (
          <div className="workspace__bottom">
            {bottomPanels.length > 1 && (
              <div className="workspace__tabs">
                {bottomPanels.map((id) => {
                  const p = panelRegistry.get(id)!;
                  const isActive = id === activeBottom;
                  return (
                    <button
                      key={id}
                      className={`workspace__tab${isActive ? " workspace__tab--active" : ""}`}
                      onClick={() => handleActivate("bottom", id)}
                    >
                      {p.title}
                    </button>
                  );
                })}
              </div>
            )}
            <div className="workspace__bottom-content">
              {renderPanel(activeBottom, false)}
            </div>
          </div>
        )}
      </div>

      {rightPanels.length > 0 && activeRight && (
        <aside className="workspace__sidebar workspace__sidebar--right">
          {rightPanels.length > 1 && (
            <div className="workspace__tabs">
              {rightPanels.map((id) => {
                const p = panelRegistry.get(id)!;
                const isActive = id === activeRight;
                return (
                  <button
                    key={id}
                    className={`workspace__tab${isActive ? " workspace__tab--active" : ""}`}
                    onClick={() => handleActivate("right", id)}
                  >
                    {p.title}
                  </button>
                );
              })}
            </div>
          )}
          <div className="workspace__panel-content">
            {renderPanel(activeRight, false)}
          </div>
        </aside>
      )}
    </div>
  );

  function renderPanel(panelId: string, _isActive: boolean) {
    const def = panelRegistry.get(panelId);
    if (!def) return null;
    const Cmp = def.component;
    return <Cmp isActive={_isActive} />;
  }

  function EmptyWorkspace() {
    return (
      <div className="workspace__empty">
        <p>No active panel. Use the command palette to open one.</p>
      </div>
    );
  }
}