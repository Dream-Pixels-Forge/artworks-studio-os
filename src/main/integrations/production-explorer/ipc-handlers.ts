/**
 * Production explorer IPC handlers.
 *
 * Wires the renderer→main channels to the ProductionFs service. Errors are
 * returned as structured ExplorerError objects, never raw Error strings,
 * so the renderer can render specific empty states.
 */
import { ipcMain } from "electron";
import { config } from "@main/core/config.js";
import { ProductionFs, isExplorerError } from "./production-fs.js";
import type { ExplorerError } from "./types.js";

const CHANNELS = {
  list: "explorer:listProductions",
  active: "explorer:getActive",
  open: "explorer:open",
  tree: "explorer:tree",
  expand: "explorer:expand",
  manifest: "explorer:manifest",
} as const;

const service = new ProductionFs(config.home);

/** Wrap an async handler so it returns structured errors over IPC. */
function safe<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
): (...args: TArgs) => Promise<TResult | ExplorerError> {
  return async (...args: TArgs) => {
    try {
      return await fn(...args);
    } catch (err) {
      if (isExplorerError(err)) return err;
      return { code: "PRODUCTION_NOT_FOUND", message: (err as Error).message };
    }
  };
}

/** Register all explorer IPC handlers. */
export function registerExplorerHandlers(): void {
  ipcMain.handle(CHANNELS.list, safe(() => service.listProductions()));
  ipcMain.handle(CHANNELS.active, safe(() => service.getActiveProduction()));
  ipcMain.handle(CHANNELS.open, safe((_: unknown, name: string) => service.openProduction(name)));
  ipcMain.handle(CHANNELS.tree, safe((_: unknown, name: string) => service.getProductionTree(name)));
  ipcMain.handle(CHANNELS.expand, safe((_: unknown, path: string) => service.expandNode(path)));
  ipcMain.handle(
    CHANNELS.manifest,
    safe((_: unknown, name: string) => service.readManifest(name)),
  );
}

export { CHANNELS };
