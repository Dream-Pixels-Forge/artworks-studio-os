/**
 * Electron main process entry.
 *
 * Owns app lifecycle: starts services, opens the studio window, and tears
 * everything down cleanly. Business logic lives in service modules; this
 * file wires them together.
 */
import { app, BrowserWindow, shell } from "electron";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { WindowManager } from "@main/app/window-manager.js";
import { registerWindowIpc } from "@main/app/window-ipc.js";
import { config } from "@main/core/config.js";
import { container, token } from "@main/core/service-container.js";
import { MIGRATIONS } from "@main/database/migrations.js";
import { StudioDatabase } from "@main/database/db.js";
import { PluginRuntime } from "@main/plugins/index.js";
import { ThemeService, registerThemeIpc, SettingsService, registerSettingsIpc, registerStudioStatusIpc } from "@main/services/index.js";
import { registerProductionIpc } from "@main/services/production-ipc.js";
import { registerPluginIpc } from "@main/services/plugin-ipc.js";
import { registerExplorerHandlers } from "@main/integrations/production-explorer/ipc-handlers.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** DI token for the studio database connection. */
export const DatabaseToken = token<StudioDatabase>("database");

const BUILTIN_PLUGINS_DIR = join(__dirname, "../../../plugins");

const themeService = new ThemeService();
const settingsService = new SettingsService();
const windowManager = new WindowManager();
let database: StudioDatabase | undefined;
let pluginRuntime: PluginRuntime | undefined;
/** True once before-quit has begun its async teardown. */
let isQuitting = false;

// Single-instance guard: focus the existing window if one is already running.
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

app.on("second-instance", () => {
  // createMain focuses the existing window if one is already open.
  windowManager.createMain();
});

app.whenReady().then(async () => {
  // Open the studio database and run any pending migrations before the UI loads.
  database = await StudioDatabase.open(join(config.home, "studio.db"), MIGRATIONS);
  container.register(DatabaseToken, () => database!);

  // Load and activate plugins before the window opens.
  pluginRuntime = new PluginRuntime(
    {
      builtinDir: BUILTIN_PLUGINS_DIR,
      userDir: join(config.home, "plugins"),
    },
    database,
  );
  await pluginRuntime.start();

  // Initialize theming (persistence + OS bridging).
  await themeService.init();
  registerThemeIpc(themeService);

  // Initialize user preferences (persistence) + studio status (home/init).
  await settingsService.init();
  registerSettingsIpc(settingsService);
  registerStudioStatusIpc();

  // Register the project explorer IPC handlers.
  registerExplorerHandlers();

  // Register production IPC (project, asset, document, search).
  registerProductionIpc(database);

  // Register plugin IPC (install, enable/disable, uninstall).
  registerPluginIpc(database);

  // Window controls (title bar) + the main window with persisted state.
  registerWindowIpc();
  await windowManager.start({ indexHtmlPath: getIndexHtml() });

  app.on("activate", () => {
    // macOS: re-open the main window when there are none left.
    if (BrowserWindow.getAllWindows().length === 0) {
      void windowManager.createMain();
    }
  });
});

/**
 * Graceful shutdown: flush window state and stop plugins before quitting.
 * `before-quit` fires once; we prevent the default, run async teardown,
 * then quit. A guard keeps a second fire (e.g. from window-all-closed)
 * from re-entering teardown.
 */
app.on("before-quit", (event) => {
  if (isQuitting) return;
  isQuitting = true;
  event.preventDefault();

  void (async () => {
    try {
      await windowManager.shutdown();
      if (pluginRuntime) {
        await pluginRuntime.stop();
        pluginRuntime = undefined;
      }
      // Close the database AFTER plugin teardown so plugin onDeactivate
      // handlers can still touch the DB if they need to.
      database?.close();
      database = undefined;
    } finally {
      app.quit();
    }
  })();
});

app.on("window-all-closed", () => {
  // DB is closed in before-quit, not here, to keep it available
  // during plugin teardown.
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
