/**
 * Window DTOs + channel constants.
 *
 * Cross-process types shared by the main window manager and the renderer
 * title bar. Lives in shared/ so both process tsconfigs can import it.
 *
 * Persisted window state is written to the studio home so the app restores
 * its last size/position/maximized state across restarts.
 */

/** Persisted window geometry. x/y are omitted when the window was maximized. */
export interface WindowState {
  /** Outer window width in px. */
  width: number;
  /** Outer window height in px. */
  height: number;
  /** Top-left x in px, relative to the work area. */
  x?: number;
  /** Top-left y in px, relative to the work area. */
  y?: number;
  /** Whether the window was maximized when last closed. */
  isMaximized?: boolean;
}

/** A rectangular display region, mirrors the part of Electron's Display we use. */
export interface DisplayBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Roles tag windows so the manager can apply role-specific behavior. */
export type WindowRole = "main" | "secondary";

/** A snapshot the Window menu renders (id + title). */
export interface WindowListEntry {
  id: number;
  title: string;
}

/**
 * Menu actions forwarded from the app menu to the focused window's
 * renderer. Renderer-side concerns (open dialogs, palette, panels) live
 * there; the menu is just a launcher.
 */
export type MenuAction = "new-production" | "open-production";

/** Renderer → main channels (invoked from the title bar / preload). */
export const WINDOW_CHANNELS = {
  minimize: "window:minimize",
  toggleMaximize: "window:maximize-toggle",
  close: "window:close",
  isMaximized: "window:is-maximized",
} as const;

/** Main → renderer push channels (sent to the window's webContents). */
export const WINDOW_EVENTS = {
  maximizedChanged: "window:maximized-changed",
} as const;

/** Renderer → main: a menu item with a studio action was triggered. */
export const MENU_ACTION_CHANNEL = "menu:action";
