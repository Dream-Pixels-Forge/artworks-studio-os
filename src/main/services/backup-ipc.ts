/**
 * Backup & Recovery IPC — 8 handlers for database backup, restore, export, import,
 * crash recovery, and stats. Phase 18.3.
 */
import { ipcMain } from "electron";
import type Database from "better-sqlite3";
import { BackupService } from "./backup-service.js";

export function registerBackupIpc(db: Database.Database): void {
  const service = new BackupService(db);

  ipcMain.handle("backup:create", (_event, type?: string, label?: string) => {
    return service.createBackup(
      (type as "manual" | "auto" | "pre_migration" | "crash_recovery") ?? "manual",
      label,
    );
  });

  ipcMain.handle("backup:list", () => {
    return service.listBackups();
  });

  ipcMain.handle("backup:restore", (_event, backupPath: string) => {
    if (!backupPath) throw new Error("backupPath is required");
    return { success: service.restoreBackup(backupPath) };
  });

  ipcMain.handle("backup:delete", (_event, uuid: string) => {
    if (!uuid) throw new Error("uuid is required");
    return { deleted: service.deleteBackup(uuid) };
  });

  ipcMain.handle("backup:export-production", (_event, entityUuid: string) => {
    if (!entityUuid) throw new Error("entityUuid is required");
    return service.exportProduction(entityUuid);
  });

  ipcMain.handle("backup:import-production", (_event, data: { entities: Array<Record<string, unknown>>; graphs?: Array<Record<string, unknown>> }) => {
    if (!data?.entities) throw new Error("entities array is required");
    return service.importProduction(data);
  });

  ipcMain.handle("backup:recover-latest", () => {
    return { success: service.recoverLatest() };
  });

  ipcMain.handle("backup:stats", () => {
    return service.getStats();
  });
}
