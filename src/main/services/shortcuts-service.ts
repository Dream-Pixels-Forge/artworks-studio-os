/**
 * Keyboard shortcuts service (main process).
 *
 * Stores custom keyboard shortcuts in a JSON file under the studio home.
 * Provides defaults and allows user overrides. The renderer reads/writes
 * through IPC and registers shortcuts via the global shortcut API.
 */
import { globalShortcut } from "electron";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { config } from "@main/core/config.js";
import { createLogger } from "@main/core/logger.js";
import type { MenuAction } from "@shared/window/index.js";

const log = createLogger("shortcuts");

function shortcutsFile(): string {
  return join(config.home, "settings", "shortcuts.json");
}

/** Default keyboard shortcuts for common actions. */
export const DEFAULT_SHORTCUTS: Record<string, string> = {
  "command-palette": "CmdOrCtrl+Shift+P",
  "toggle-theme": "CmdOrCtrl+Shift+T",
  "save": "CmdOrCtrl+S",
  "new-entity": "CmdOrCtrl+N",
  "search": "CmdOrCtrl+Shift+F",
  "open-settings": "CmdOrCtrl+,",
  "toggle-sidebar": "CmdOrCtrl+B",
  "toggle-terminal": "CmdOrCtrl+`",
};

export interface ShortcutsState {
  shortcuts: Record<string, string>;
  defaults: Record<string, string>;
}

export class ShortcutsService {
  private shortcuts: Record<string, string> = {};
  private registered = new Map<string, string>(); // accelerator → actionId
  private onAction: ((action: MenuAction) => void) | null = null;

  /** Set the callback that dispatches menu actions to the renderer. */
  setOnAction(handler: (action: MenuAction) => void): void {
    this.onAction = handler;
  }

  async init(): Promise<ShortcutsState> {
    this.shortcuts = await this.readShortcuts();
    this.registerAll();
    log.info("shortcuts initialized", { overrides: Object.keys(this.shortcuts) });
    return this.state();
  }

  async setShortcut(actionId: string, accelerator: string): Promise<ShortcutsState> {
    this.shortcuts[actionId] = accelerator;
    await this.writeShortcuts();
    this.unregisterAll();
    this.registerAll();
    log.info("shortcut set", { actionId, accelerator });
    return this.state();
  }

  async resetShortcut(actionId: string): Promise<ShortcutsState> {
    delete this.shortcuts[actionId];
    await this.writeShortcuts();
    this.unregisterAll();
    this.registerAll();
    log.info("shortcut reset", { actionId });
    return this.state();
  }

  async resetAll(): Promise<ShortcutsState> {
    this.shortcuts = {};
    await this.writeShortcuts();
    this.unregisterAll();
    this.registerAll();
    log.info("all shortcuts reset to defaults");
    return this.state();
  }

  /** Get the effective accelerator for an action. */
  getAccelerator(actionId: string): string {
    return this.shortcuts[actionId] ?? DEFAULT_SHORTCUTS[actionId] ?? "";
  }

  state(): ShortcutsState {
    return {
      shortcuts: { ...this.shortcuts },
      defaults: { ...DEFAULT_SHORTCUTS },
    };
  }

  destroy(): void {
    this.unregisterAll();
  }

  private registerAll(): void {
    for (const [actionId] of Object.entries(DEFAULT_SHORTCUTS)) {
      const accelerator = this.getAccelerator(actionId);
      if (!accelerator) continue;
      try {
        const registered = globalShortcut.register(accelerator, () => {
          log.info("shortcut triggered", { actionId, accelerator });
          if (this.onAction) {
            this.onAction(actionId as MenuAction);
          }
        });
        if (registered) {
          this.registered.set(accelerator, actionId);
        }
      } catch (err) {
        log.error("failed to register shortcut", { actionId, accelerator, error: (err as Error).message });
      }
    }
  }

  private unregisterAll(): void {
    for (const accelerator of this.registered.keys()) {
      try {
        globalShortcut.unregister(accelerator);
      } catch {
        // ignore — may not be registered
      }
    }
    this.registered.clear();
  }

  private async readShortcuts(): Promise<Record<string, string>> {
    const file = shortcutsFile();
    try {
      if (!existsSync(file)) return {};
      const raw = await readFile(file, "utf-8");
      const parsed = JSON.parse(raw) as { shortcuts?: unknown };
      if (typeof parsed.shortcuts === "object" && parsed.shortcuts !== null) {
        const shortcuts = parsed.shortcuts as Record<string, unknown>;
        const result: Record<string, string> = {};
        for (const [k, v] of Object.entries(shortcuts)) {
          if (typeof v === "string") result[k] = v;
        }
        return result;
      }
      return {};
    } catch {
      return {};
    }
  }

  private async writeShortcuts(): Promise<void> {
    const file = shortcutsFile();
    try {
      await mkdir(dirname(file), { recursive: true });
      await writeFile(file, JSON.stringify({ shortcuts: this.shortcuts }, null, 2), "utf-8");
    } catch (err) {
      log.error("could not persist shortcuts", { error: (err as Error).message });
    }
  }
}
