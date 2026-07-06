/**
 * SinglePanelWindow — the root mounted in a detached panel's BrowserWindow.
 *
 * When the WindowManager opens a secondary window it loads the same index.html
 * with `?panel=<id>`; main.tsx reads that query and mounts this component
 * instead of <StudioShell>. The component imports the workspace barrel so all
 * built-in panels self-register, looks up the requested panel in the registry,
 * and renders it inside a minimal frame (a slim title strip + the panel). The
 * frame's close button asks the main process to close this window — when that
 * happens, WindowManager broadcasts a re-dock event to the main window so the
 * panel reappears at its default slot (lossless).
 */
import type { ReactNode, MouseEvent } from "react";
import { panelRegistry } from "./registry.js";
// Side-effect import: registers every built-in panel so the registry lookup
// below can resolve any of them. Same effect as the main shell gets on boot.
import "./index.js";

export interface SinglePanelWindowProps {
  /** Panel id taken from the `?panel=` query param. */
  panelId: string;
}

export function SinglePanelWindow({ panelId }: SinglePanelWindowProps): ReactNode {
  const def = panelRegistry.get(panelId);

  const close = (e: MouseEvent<HTMLButtonElement>): void => {
    e.preventDefault();
    // Sends on this window's webContents; main resolves the sender and closes
    // only this window. The WindowManager then broadcasts detachedClosed.
    window.artworks.window.close();
  };

  if (!def) {
    return (
      <div className="single-panel-window single-panel-window--empty">
        <div className="single-panel-window__bar">
          <span className="single-panel-window__title">Unknown panel</span>
          <button className="single-panel-window__close" aria-label="Close window" onClick={close}>×</button>
        </div>
        <div className="single-panel-window__body">No panel registered for id “{panelId}”.</div>
      </div>
    );
  }

  const Panel = def.component;
  return (
    <div className="single-panel-window">
      <div className="single-panel-window__bar">
        {def.icon ? <span className="single-panel-window__icon" aria-hidden>{def.icon}</span> : null}
        <span className="single-panel-window__title">{def.title}</span>
        <button className="single-panel-window__close" aria-label="Close window" onClick={close}>×</button>
      </div>
      <div className="single-panel-window__body">
        {/* A detached panel is always the visible panel, so isActive is true. */}
        <Panel isActive />
      </div>
    </div>
  );
}
