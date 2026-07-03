/**
 * Presence service.
 *
 * Tracks which user is viewing/editing a document (cursor position,
 * selection range, user metadata). Presence is ephemeral — stored in
 * memory and broadcast via the collaboration IPC bus. It does not
 * persist across app restarts.
 */

export interface PresenceEntry {
  userUuid: string;
  userName: string;
  documentId: string;
  cursor?: CursorPosition;
  selection?: SelectionRange;
  lastSeen: string; // ISO datetime
}

export interface CursorPosition {
  /** Character offset from start of document. */
  index: number;
  /** Length of selection (0 = collapsed cursor). */
  length: number;
}

export interface SelectionRange {
  anchor: number;
  head: number;
}

export class PresenceService {
  /** Map of userUuid → documentId → PresenceEntry. */
  private entries = new Map<string, Map<string, PresenceEntry>>();

  /** Register or update a user's presence on a document. */
  updatePresence(
    userUuid: string,
    userName: string,
    documentId: string,
    cursor?: CursorPosition,
    selection?: SelectionRange,
  ): void {
    if (!this.entries.has(userUuid)) {
      this.entries.set(userUuid, new Map());
    }
    const userDocs = this.entries.get(userUuid)!;
    userDocs.set(documentId, {
      userUuid,
      userName,
      documentId,
      cursor,
      selection,
      lastSeen: new Date().toISOString(),
    });
  }

  /** Remove a user's presence from a document. */
  removePresence(userUuid: string, documentId: string): void {
    const userDocs = this.entries.get(userUuid);
    if (userDocs) {
      userDocs.delete(documentId);
      if (userDocs.size === 0) {
        this.entries.delete(userUuid);
      }
    }
  }

  /** Remove all presence for a user (e.g. disconnect). */
  removeUser(userUuid: string): void {
    this.entries.delete(userUuid);
  }

  /** Get all users currently present on a document. */
  getDocumentPresence(documentId: string): PresenceEntry[] {
    const result: PresenceEntry[] = [];
    for (const userDocs of this.entries.values()) {
      const entry = userDocs.get(documentId);
      if (entry) {
        // Evict stale entries (no activity for 60 seconds).
        const age =
          Date.now() - new Date(entry.lastSeen).getTime();
        if (age < 60_000) {
          result.push(entry);
        } else {
          userDocs.delete(documentId);
        }
      }
    }
    return result;
  }

  /** Get all active documents (for dashboard/overview). */
  getActiveDocuments(): string[] {
    const docIds = new Set<string>();
    for (const userDocs of this.entries.values()) {
      for (const [docId, entry] of userDocs) {
        const age =
          Date.now() - new Date(entry.lastSeen).getTime();
        if (age < 60_000) {
          docIds.add(docId);
        } else {
          userDocs.delete(docId);
        }
      }
    }
    return [...docIds];
  }
}
