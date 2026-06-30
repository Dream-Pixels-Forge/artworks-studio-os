/**
 * Window-control IPC handlers.
 *
 * Wires the renderer→main channels the title bar invokes (minimize, toggle
 * maximize, close, query maximized). Each handler resolves the calling
 * window via the event's sender, so every window controls only itself.
 */
import { BrowserWindow, ipcMain, type WebContents } from "electron";
import { WINDOW_CHANNELS } from "@shared/window/index.js";

/** Resolve the BrowserWindow that sent an IPC event, if it still exists. */
function senderWindow(sender: WebContents): BrowserWindow | undefined {
  return BrowserWindow.fromWebContents(sender) ?? undefined;
}

/** Register the window-control IPC handlers. */
export function registerWindowIpc(): void {
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
}
