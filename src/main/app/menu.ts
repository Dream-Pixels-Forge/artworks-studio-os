/**
 * Application menu.
 *
 * Builds the studio's menu bar: standard roles (undo/cut/copy/paste, view,
 * window) plus studio actions (New/Open Production) that are forwarded to
 * the focused window's renderer, and a dynamic open-windows list.
 *
 * The pure template builder is split from Electron's Menu so the shape can
 * be unit-tested without the API.
 */
import { Menu, type MenuItemConstructorOptions } from "electron";
import { MENU_ACTION_CHANNEL, type MenuAction, type WindowListEntry } from "@shared/window/index.js";

/** Callbacks the menu needs from the window manager. */
export interface MenuDeps {
  /** Forward a studio menu action to the focused window. */
  onAction: (action: MenuAction) => void;
  /** Rebuild + re-apply the menu (after the windows list changes). */
  rebuild: () => void;
  /** Current list of open windows, for the dynamic Window menu. */
  windows: () => WindowListEntry[];
  /** Focus a window by id. */
  focusWindow: (id: number) => void;
}

const STUDIO_ACTIONS: { action: MenuAction; label: string; accelerator?: string }[] = [
  { action: "new-production", label: "New Production" },
  { action: "open-production", label: "Open Production…", accelerator: "CmdOrCtrl+O" },
];

/**
 * Build the menu template as plain data. Pure — no Electron calls. The
 * `click` handlers call back into deps rather than acting directly.
 *
 * Submenu arrays are typed as MenuItemConstructorOptions[] so the literal
 * `role`/`type` strings are checked against Electron's union, not widened.
 */
export function buildMenuTemplate(deps: MenuDeps): MenuItemConstructorOptions[] {
  const isMac = process.platform === "darwin";

  const appMenu: MenuItemConstructorOptions = isMac
    ? {
        label: "Artworks Studio OS",
        submenu: [
          { role: "about", label: "About Artworks Studio OS" },
          { type: "separator" },
          { role: "services" },
          { type: "separator" },
          { role: "hide" },
          { role: "hideOthers" },
          { role: "unhide" },
          { type: "separator" },
          { role: "quit" },
        ],
      }
    : { label: "File", submenu: [{ role: "quit", accelerator: "Alt+F4" }] };

  const studioItems: MenuItemConstructorOptions[] = STUDIO_ACTIONS.map((item) => ({
    label: item.label,
    accelerator: item.accelerator,
    click: () => deps.onAction(item.action),
  }));

  const fileMenu: MenuItemConstructorOptions = {
    label: "File",
    submenu: [
      ...studioItems,
      { type: "separator" },
      isMac ? { role: "close" } : { role: "quit" },
    ],
  };

  const editMenu: MenuItemConstructorOptions = {
    label: "Edit",
    submenu: [
      { role: "undo" },
      { role: "redo" },
      { type: "separator" },
      { role: "cut" },
      { role: "copy" },
      { role: "paste" },
      ...(isMac
        ? ([
            { role: "pasteAndMatchStyle" },
            { role: "delete" },
            { role: "selectAll" },
            { type: "separator" },
            {
              label: "Speech",
              submenu: [{ role: "startSpeaking" }, { role: "stopSpeaking" }],
            },
          ] satisfies MenuItemConstructorOptions[])
        : ([{ role: "selectAll" }] satisfies MenuItemConstructorOptions[])),
    ],
  };

  const viewMenu: MenuItemConstructorOptions = {
    label: "View",
    submenu: [
      { role: "reload" },
      { role: "forceReload" },
      { role: "toggleDevTools" },
      { type: "separator" },
      { role: "resetZoom" },
      { role: "zoomIn" },
      { role: "zoomOut" },
      { type: "separator" },
      { role: "togglefullscreen" },
    ],
  };

  const windowItems: MenuItemConstructorOptions[] = deps
    .windows()
    .map((w) => ({ label: w.title, click: () => deps.focusWindow(w.id) }));

  const windowMenu: MenuItemConstructorOptions = {
    label: "Window",
    submenu: [
      { role: "minimize" },
      { role: "zoom" },
      ...(isMac
        ? ([
            { type: "separator" },
            { role: "front" },
            { type: "separator" },
            { role: "window" },
          ] satisfies MenuItemConstructorOptions[])
        : ([{ role: "close" }] satisfies MenuItemConstructorOptions[])),
      ...(windowItems.length > 0
        ? ([{ type: "separator" }, ...windowItems] satisfies MenuItemConstructorOptions[])
        : ([] satisfies MenuItemConstructorOptions[])),
    ],
  };

  const helpMenu: MenuItemConstructorOptions = {
    label: "Help",
    submenu: [
      {
        label: "Documentation",
        enabled: false, // wired when the Help surface arrives in a later phase
      },
    ],
  };

  return [appMenu, fileMenu, editMenu, viewMenu, windowMenu, helpMenu];
}

/** Build the menu template and turn it into a real Electron Menu. */
export function buildAppMenu(deps: MenuDeps): Menu {
  return Menu.buildFromTemplate(buildMenuTemplate(deps));
}

/** Re-exported for the window manager to forward menu actions. */
export { MENU_ACTION_CHANNEL };
