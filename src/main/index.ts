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
import { config } from "@main/core/config.js";
import { container, token } from "@main/core/service-container.js";
import { MIGRATIONS } from "@main/database/migrations.js";
import { StudioDatabase } from "@main/database/db.js";
import { PluginRuntime } from "@main/plugins/index.js";
import { ThemeService, registerThemeIpc } from "@main/services/index.js";
import { registerExplorerHandlers } from "@main/integrations/production-explorer/ipc-handlers.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** DI token for the studio database connection. */
export const DatabaseToken = token<StudioDatabase>("database");

const BUILTIN_PLUGINS_DIR = join(__dirname, "../../../plugins");

const themeService = new ThemeService();
let database: StudioDatabase | undefined;
let pluginRuntime: PluginRuntime | undefined;

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

app.whenReady().then(async () => {
  // Open the studio database and run any pending migrations before the UI loads.
  database = await StudioDatabase.open(join(config.home, "studio.db"), MIGRATIONS);
  container.register(DatabaseToken, () => database!);

  // Load and activate plugins before the window opens.
  pluginRuntime = new PluginRuntime({
    builtinDir: BUILTIN_PLUGINS_DIR,
    userDir: join(config.home, "plugins"),
  });
  await pluginRuntime.start();

  // Initialize theming (persistence + OS bridging).
  await themeService.init();
  registerThemeIpc(themeService);

  // Register the project explorer IPC handlers.
  registerExplorerHandlers();

  createWindow({ indexHtmlPath: getIndexHtml() });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow({ indexHtmlPath: getIndexHtml() });
    }
  });
});

app.on("before-quit", async (event) => {
  if (pluginRuntime) {
    event.preventDefault();
    await pluginRuntime.stop();
    pluginRuntime = undefined;
    app.quit();
  }
});

app.on("window-all-closed", () => {
  database?.close();
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
