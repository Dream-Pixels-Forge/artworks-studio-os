/**
 * Collaboration IPC handlers.
 *
 * Bridges the CrdtService and PresenceService to the renderer process
 * via ipcMain.handle(). All handlers are registered once during app
 * startup and remain available for the lifetime of the application.
 */

import { ipcMain } from "electron";
import type { CrdtService } from "./crdt-service.js";
import type { PresenceService, CursorPosition, SelectionRange } from "./presence-service.js";

export interface CollaborationHandlers {
  crdt: CrdtService;
  presence: PresenceService;
}

/** Register all collaboration IPC handlers. */
export function registerCollaborationIpc(
  crdt: CrdtService,
  presence: PresenceService,
): void {
  // ── CRDT operations ────────────────────────────────────────────

  ipcMain.handle(
    "collab:getDocumentContent",
    (_event, documentId: string) => {
      return crdt.getDocumentContent(documentId);
    },
  );

  ipcMain.handle(
    "collab:getDocumentMetadata",
    (_event, documentId: string) => {
      return crdt.getDocumentMetadata(documentId);
    },
  );

  ipcMain.handle(
    "collab:getStateVector",
    (_event, documentId: string) => {
      return crdt.getStateVector(documentId);
    },
  );

  ipcMain.handle(
    "collab:applyUpdate",
    (_event, documentId: string, updateBase64: string) => {
      return crdt.applyUpdate(documentId, updateBase64);
    },
  );

  ipcMain.handle(
    "collab:getVersionClock",
    (_event, documentId: string) => {
      return crdt.getVersionClock(documentId);
    },
  );

  ipcMain.handle(
    "collab:flush",
    () => {
      return crdt.flush();
    },
  );

  ipcMain.handle(
    "collab:destroyDoc",
    (_event, documentId: string) => {
      crdt.destroyDoc(documentId);
    },
  );

  // ── Presence operations ────────────────────────────────────────

  ipcMain.handle(
    "collab:updatePresence",
    (
      _event,
      userUuid: string,
      userName: string,
      documentId: string,
      cursor?: CursorPosition,
      selection?: SelectionRange,
    ) => {
      presence.updatePresence(userUuid, userName, documentId, cursor, selection);
    },
  );

  ipcMain.handle(
    "collab:removePresence",
    (_event, userUuid: string, documentId: string) => {
      presence.removePresence(userUuid, documentId);
    },
  );

  ipcMain.handle(
    "collab:getDocumentPresence",
    (_event, documentId: string) => {
      return presence.getDocumentPresence(documentId);
    },
  );

  ipcMain.handle(
    "collab:getActiveDocuments",
    () => {
      return presence.getActiveDocuments();
    },
  );

  ipcMain.handle(
    "collab:removeUser",
    (_event, userUuid: string) => {
      presence.removeUser(userUuid);
    },
  );
}
