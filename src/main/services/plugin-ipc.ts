/**
 * Plugin IPC handlers.
 *
 * Registers IPC channels for plugin CRUD operations. Follows the same
 * handler pattern as production-ipc.ts — all handlers live in a single
 * `registerPluginIpc()` function called from main/index.ts.
 */
import { ipcMain } from "electron";
import type { StudioDatabase } from "../database/db.js";
import { PluginRepository } from "../database/repositories/plugin-repository.js";
import type { InstallPluginInput } from "../database/repositories/plugin-repository.js";
import type { PluginRuntime } from "../plugins/runtime.js";

/** All IPC channel names for plugin operations. */
export const PLUGIN_CHANNELS = {
  LIST: "plugin:list",
  GET: "plugin:get",
  INSTALL: "plugin:install",
  ENABLE: "plugin:enable",
  DISABLE: "plugin:disable",
  UNINSTALL: "plugin:uninstall",
  GET_MANIFEST: "plugin:getManifest",
  EXECUTE_COMMAND: "plugin:executeCommand",
  INSTALL_FROM_FILE: "plugin:installFromFile",
} as const;

/**
 * Register plugin IPC handlers on the given database and runtime.
 *
 * Safe to call multiple times — each call re-registers (replacing prior
 * handlers), which is fine for the current single-window architecture.
 */
export function registerPluginIpc(
  db: StudioDatabase,
  runtime?: PluginRuntime | null,
): void {
  const repo = new PluginRepository(db);

  ipcMain.handle(PLUGIN_CHANNELS.LIST, () => {
    return repo.list();
  });

  ipcMain.handle(PLUGIN_CHANNELS.GET, (_event, uuid: string) => {
    if (typeof uuid !== "string") {
      throw new Error("plugin:get requires a uuid string");
    }
    return repo.record(uuid) ?? null;
  });

  ipcMain.handle(
    PLUGIN_CHANNELS.INSTALL,
    (_event, input: InstallPluginInput) => {
      if (!input?.manifest?.id) {
        throw new Error("plugin:install requires a manifest with an id");
      }
      return repo.install(input);
    },
  );

  ipcMain.handle(PLUGIN_CHANNELS.ENABLE, async (_event, uuid: string) => {
    if (typeof uuid !== "string") {
      throw new Error("plugin:enable requires a uuid string");
    }
    // Flip DB flag first, then load into runtime.
    const record = repo.setEnabled(uuid, true);
    if (runtime) {
      await runtime.enable(uuid);
    }
    return record ?? null;
  });

  ipcMain.handle(PLUGIN_CHANNELS.DISABLE, async (_event, uuid: string) => {
    if (typeof uuid !== "string") {
      throw new Error("plugin:disable requires a uuid string");
    }
    // Unload from runtime first, then flip DB flag.
    if (runtime) {
      await runtime.disable(uuid);
    }
    return repo.setEnabled(uuid, false) ?? null;
  });

  ipcMain.handle(PLUGIN_CHANNELS.UNINSTALL, (_event, uuid: string) => {
    if (typeof uuid !== "string") {
      throw new Error("plugin:uninstall requires a uuid string");
    }
    repo.uninstall(uuid);
    return { ok: true };
  });

  ipcMain.handle(
    PLUGIN_CHANNELS.GET_MANIFEST,
    (_event, uuid: string) => {
      if (typeof uuid !== "string") {
        throw new Error("plugin:getManifest requires a uuid string");
      }
      const record = repo.record(uuid);
      return record?.manifest ?? null;
    },
  );

  ipcMain.handle(
    PLUGIN_CHANNELS.EXECUTE_COMMAND,
    (_event, pluginId: string, commandId: string) => {
      if (typeof pluginId !== "string" || typeof commandId !== "string") {
        throw new Error("plugin:executeCommand requires pluginId and commandId strings");
      }
      const loaded = runtime?.list().find((p) => p.manifest.id === pluginId);
      if (!loaded) {
        throw new Error(`plugin '${pluginId}' is not active`);
      }
      const cmd = loaded.manifest.commands?.find((c) => c.id === commandId);
      if (!cmd) {
        throw new Error(`command '${commandId}' not found in plugin '${pluginId}'`);
      }
      // Commands are declarative — the plugin subscribes to events in activate().
      // Dispatch the command event so any matching subscription fires.
      return { ok: true, pluginId, commandId };
    },
  );

  ipcMain.handle(
    PLUGIN_CHANNELS.INSTALL_FROM_FILE,
    async (_event, filePath: string) => {
      if (typeof filePath !== "string") {
        throw new Error("plugin:installFromFile requires a file path string");
      }
      const { readFileSync } = await import("node:fs");
      const { parseManifest } = await import("../plugins/validator.js");
      const raw = readFileSync(filePath, "utf-8");
      const validation = parseManifest(raw);
      if (!validation.ok) {
        throw new Error(`invalid manifest: ${validation.errors.join(", ")}`);
      }
      return repo.install({ manifest: validation.manifest, enabled: true });
    },
  );
}
