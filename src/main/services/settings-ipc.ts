/**
 * Settings IPC handlers.
 *
 * Wires the renderer→main channels (settings:get / set / reset) to the
 * SettingsService. The renderer never touches the filesystem directly — it
 * reads/writes preferences through this surface.
 */
import { ipcMain } from "electron";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { config } from "@main/core/config.js";
import {
  SETTINGS_CHANNELS,
  STUDIO_CHANNELS,
  type Preferences,
  type SettingsState,
} from "@shared/settings/index.js";
import type { SettingsService } from "./settings-service.js";

/** Register the settings IPC handlers against the given service. */
export function registerSettingsIpc(service: SettingsService): void {
  ipcMain.handle(SETTINGS_CHANNELS.get, (): SettingsState => service.state());

  ipcMain.handle(
    SETTINGS_CHANNELS.set,
    (_event, key: keyof Preferences, value: string | undefined): Promise<SettingsState> =>
      service.setPreference(key, value),
  );

  ipcMain.handle(SETTINGS_CHANNELS.reset, (): Promise<SettingsState> => service.reset());
}

/**
 * Register the studio status handler (home resolution + init marker). This
 * backs the long-stubbed `studio.status()` — it reports where the studio home
 * lives and whether it's been initialized, using the same studio.json marker
 * the `aw` CLI and ProductionFs recognize.
 */
export function registerStudioStatusIpc(): void {
  ipcMain.handle(STUDIO_CHANNELS.status, (): { initialized: boolean; home: string } => {
    // The studio init marker mirrors aw/src/aw/services/studio.py.
    const initialized = existsSync(join(config.home, "studio.json"));
    return { initialized, home: config.home };
  });
}

export { SETTINGS_CHANNELS, STUDIO_CHANNELS };
