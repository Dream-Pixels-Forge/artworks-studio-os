/**
 * Window-control IPC handlers.
 *
 * Wires the renderer→main channels the title bar invokes (minimize, toggle
 * maximize, close, query maximized) plus the detach-panel channel. Each
 * handler resolves the calling window via the event's sender, so every window
 * controls only itself.
 */
import { BrowserWindow, ipcMain, dialog, type WebContents } from "electron";
import { WINDOW_CHANNELS } from "@shared/window/index.js";
import type { WindowManager } from "./window-manager.js";

/** Resolve the BrowserWindow that sent an IPC event, if it still exists. */
function senderWindow(sender: WebContents): BrowserWindow | undefined {
  return BrowserWindow.fromWebContents(sender) ?? undefined;
}

/** Register the window-control IPC handlers. */
export function registerWindowIpc(windowManager: WindowManager): void {
  ipcMain.handle(WINDOW_CHANNELS.isMaximized, (event): boolean => {
    return senderWindow(event.sender)?.isMaximized() ?? false;
  });

  ipcMain.on(WINDOW_CHANNELS.minimize, (event) => {
    senderWindow(event.sender)?.minimize();
  });

  ipcMain.on(WINDOW_CHANNELS.toggleMaximize, (event) => {
    const window = senderWindow(event.sender);
    if (!window) return;
    if (window.isMaximized()) window.unmaximize();
    else window.maximize();
  });

  ipcMain.on(WINDOW_CHANNELS.close, (event) => {
    senderWindow(event.sender)?.close();
  });

  // Pop a panel out into its own secondary window. The renderer passes the
  // panel id + title; the manager opens a tracked window loading the same
  // index with `?panel=<id>`, which main.tsx routes to <SinglePanelWindow>.
  ipcMain.handle(
    WINDOW_CHANNELS.detachPanel,
    async (_event, payload: { panelId: string; title: string }): Promise<{ windowId: number }> => {
      const window = windowManager.createSecondary({ title: payload.title, panelId: payload.panelId });
      return { windowId: window.id };
    },
  );

  ipcMain.handle("dialog:openFile", async (event, options?: { filters?: Array<{ name: string; extensions: string[] }> }) => {
    const window = senderWindow(event.sender);
    if (!window) return { canceled: true, filePaths: [] };
    return dialog.showOpenDialog(window, {
      properties: ["openFile"],
      filters: options?.filters ?? [{ name: "Plugins", extensions: ["zip", "tar", "tgz"] }],
    });
  });
}
