/**
 * Notification Center IPC — 10 handlers for real-time notification management.
 * Phase 18.2: Notification Center.
 */
import { ipcMain } from "electron";
import type Database from "better-sqlite3";
import { NotificationRepository } from "@main/database/repositories/notification-repository.js";
import type { NotificationType } from "@main/database/repositories/notification-repository.js";

export function registerNotificationIpc(db: Database.Database): void {
  const repo = new NotificationRepository(db);

  ipcMain.handle("notification:create", (_event, input: {
    type: NotificationType;
    title: string;
    message: string;
    source?: string;
    source_uuid?: string;
    actor_uuid?: string;
    action_url?: string;
    metadata?: Record<string, unknown>;
  }) => {
    if (!input?.type || !input?.title || !input?.message) {
      throw new Error("type, title, and message are required");
    }
    return repo.create(input);
  });

  ipcMain.handle("notification:list", (_event, filter?: {
    type?: NotificationType;
    source?: string;
    read?: boolean;
    dismissed?: boolean;
    since?: string;
    limit?: number;
  }) => {
    return repo.list(filter);
  });

  ipcMain.handle("notification:get", (_event, uuid: string) => {
    if (!uuid) throw new Error("uuid is required");
    return repo.getByUuid(uuid) ?? null;
  });

  ipcMain.handle("notification:mark-read", (_event, uuid: string) => {
    if (!uuid) throw new Error("uuid is required");
    return repo.markRead(uuid) ?? null;
  });

  ipcMain.handle("notification:mark-all-read", () => {
    return { count: repo.markAllRead() };
  });

  ipcMain.handle("notification:dismiss", (_event, uuid: string) => {
    if (!uuid) throw new Error("uuid is required");
    return repo.dismiss(uuid) ?? null;
  });

  ipcMain.handle("notification:dismiss-all", () => {
    return { count: repo.dismissAll() };
  });

  ipcMain.handle("notification:unread-count", () => {
    return { count: repo.getUnreadCount() };
  });

  ipcMain.handle("notification:stats", () => {
    return repo.getStats();
  });

  ipcMain.handle("notification:delete", (_event, uuid: string) => {
    if (!uuid) throw new Error("uuid is required");
    return { deleted: repo.delete(uuid) };
  });
}
