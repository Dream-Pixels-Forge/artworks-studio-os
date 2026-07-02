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

/** All IPC channel names for plugin operations. */
export const PLUGIN_CHANNELS = {
  LIST: "plugin:list",
  GET: "plugin:get",
  INSTALL: "plugin:install",
  ENABLE: "plugin:enable",
  DISABLE: "plugin:disable",
  UNINSTALL: "plugin:uninstall",
  GET_MANIFEST: "plugin:getManifest",
} as const;

/**
 * Register plugin IPC handlers on the given database.
 *
 * Safe to call multiple times — each call re-registers (replacing prior
 * handlers), which is fine for the current single-window architecture.
 */
export function registerPluginIpc(db: StudioDatabase): void {
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

  ipcMain.handle(PLUGIN_CHANNELS.ENABLE, (_event, uuid: string) => {
    if (typeof uuid !== "string") {
      throw new Error("plugin:enable requires a uuid string");
    }
    return repo.setEnabled(uuid, true) ?? null;
  });

  ipcMain.handle(PLUGIN_CHANNELS.DISABLE, (_event, uuid: string) => {
    if (typeof uuid !== "string") {
      throw new Error("plugin:disable requires a uuid string");
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
}
