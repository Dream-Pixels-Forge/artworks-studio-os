/**
 * Electron main process entry.
 *
 * Owns app lifecycle: creates the studio window and tears it down cleanly.
 * Business logic lives in service modules; this file wires them together.
 */
import { app, BrowserWindow, shell } from "electron";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createWindow } from "@main/app/window.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Single-instance guard: focus the existing window if one is already running.
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

app.on("second-instance", () => {
  for (const window of BrowserWindow.getAllWindows()) {
    if (window.isMinimized()) window.restore();
    window.focus();
  }
});

app.whenReady().then(() => {
  createWindow({ indexHtmlPath: getIndexHtml() });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow({ indexHtmlPath: getIndexHtml() });
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

// Open external links in the user's browser, never in-app.
app.on("web-contents-created", (_event, contents) => {
  contents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
});

function getIndexHtml(): string {
  // dev server vs production build path (electron-vite convention).
  if (process.env["ELECTRON_RENDERER_URL"]) {
    return process.env["ELECTRON_RENDERER_URL"];
  }
  return join(__dirname, "../renderer/index.html");
}
