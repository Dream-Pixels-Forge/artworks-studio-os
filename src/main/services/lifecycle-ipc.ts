/**
 * Production Lifecycle IPC handlers.
 *
 * Formal production lifecycle state machine with transition guards
 * and audit trail.
 */
import { ipcMain } from "electron";
import type { StudioDatabase } from "@main/database/db.js";
import { LifecycleRepository, type LifecycleState } from "@main/database/repositories/lifecycle-repository.js";

export function registerLifecycleIpc(db: StudioDatabase): void {
  const repo = new LifecycleRepository(db);

  ipcMain.handle("lifecycle:get", (_event, entityUuid: string) => {
    return repo.getByEntity(entityUuid) ?? null;
  });

  ipcMain.handle("lifecycle:list", (_event, filter?: { state?: LifecycleState }) => {
    return repo.list(filter);
  });

  ipcMain.handle("lifecycle:create", (_event, entityUuid: string, enteredBy?: string) => {
    return repo.create(entityUuid, enteredBy);
  });

  ipcMain.handle(
    "lifecycle:transition",
    (_event, entityUuid: string, toState: LifecycleState, triggeredBy?: string, reason?: string) => {
      return repo.transition(entityUuid, toState, triggeredBy, reason);
    }
  );

  ipcMain.handle("lifecycle:can-transition", (_event, from: LifecycleState, to: LifecycleState) => {
    return repo.canTransition(from, to);
  });

  ipcMain.handle("lifecycle:valid-transitions", (_event, from: LifecycleState) => {
    return repo.validTransitions(from);
  });

  ipcMain.handle("lifecycle:history", (_event, entityUuid: string, limit?: number) => {
    return repo.history(entityUuid, limit);
  });

  ipcMain.handle("lifecycle:all-transitions", (_event, limit?: number) => {
    return repo.allTransitions(limit);
  });

  ipcMain.handle("lifecycle:stats", () => {
    return repo.stats();
  });

  ipcMain.handle("lifecycle:delete", (_event, entityUuid: string) => {
    return repo.delete(entityUuid);
  });
}
