/**
 * API key + Shortcuts IPC handlers.
 *
 * Wires the renderer→main channels for API key management and keyboard
 * shortcuts to their respective services.
 */
import { ipcMain } from "electron";
import type { ApiKeyService } from "./api-key-service.js";
import type { ShortcutsService } from "./shortcuts-service.js";

const API_KEY_CHANNELS = {
  get: "api-keys:get",
  set: "api-keys:set",
  delete: "api-keys:delete",
} as const;

const SHORTCUT_CHANNELS = {
  get: "shortcuts:get",
  set: "shortcuts:set",
  "reset-action": "shortcuts:reset-action",
  "reset-all": "shortcuts:reset-all",
} as const;

export function registerApiKeyIpc(service: ApiKeyService): void {
  ipcMain.handle(API_KEY_CHANNELS.get, () => service.state());
  ipcMain.handle(API_KEY_CHANNELS.set, (_event, provider: string, apiKey: string) =>
    service.setKey(provider, apiKey),
  );
  ipcMain.handle(API_KEY_CHANNELS.delete, (_event, provider: string) =>
    service.deleteKey(provider),
  );
}

export function registerShortcutsIpc(service: ShortcutsService): void {
  ipcMain.handle(SHORTCUT_CHANNELS.get, () => service.state());
  ipcMain.handle(SHORTCUT_CHANNELS.set, (_event, actionId: string, accelerator: string) =>
    service.setShortcut(actionId, accelerator),
  );
  ipcMain.handle(SHORTCUT_CHANNELS["reset-action"], (_event, actionId: string) =>
    service.resetShortcut(actionId),
  );
  ipcMain.handle(SHORTCUT_CHANNELS["reset-all"], () => service.resetAll());
}

export { API_KEY_CHANNELS, SHORTCUT_CHANNELS };
