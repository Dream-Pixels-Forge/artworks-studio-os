/**
 * Yjs-based CRDT service.
 *
 * Manages Yjs documents for each production asset, provides the
 * collaboration API to the renderer, and handles periodic SQLite
 * persistence of Yjs state vectors.
 *
 * Yjs documents are keyed by documentId (asset uuid).
 * Each document contains:
 *   - A Y.Text named "content" for the document body.
 *   - A Y.Map named "metadata" for attributes (title, tags, etc.).
 */

import * as Y from "yjs";
import type { StudioDatabase } from "@main/database/db.js";

/** Persisted Yjs state vector metadata. */
export interface CrdtDocumentMeta {
  uuid: string;
  document_id: string;
  yjs_state: string;
  version_clock: number;
  created_at: string;
  updated_at: string;
}

export class CrdtService {
  private docs = new Map<string, Y.Doc>();
  private dirtyDocs = new Set<string>();
  private flushTimer: ReturnType<typeof setInterval> | null = null;

  constructor(private db: StudioDatabase) {}

  /** Ensure the crdt_documents table exists. */
  async init(): Promise<void> {
    this.db.execMany(`
      CREATE TABLE IF NOT EXISTS crdt_documents (
        uuid          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        document_id   TEXT NOT NULL UNIQUE,
        yjs_state     TEXT NOT NULL,
        version_clock INTEGER NOT NULL DEFAULT 0,
        created_at    TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_crdt_documents_document_id
        ON crdt_documents(document_id);
    `);

    // Start the periodic flush timer (every 30 seconds).
    this.flushTimer = setInterval(() => {
      void this.flush();
    }, 30_000);
  }

  /** Get or create a Yjs document for a given documentId. */
  getDoc(documentId: string): Y.Doc {
    let doc = this.docs.get(documentId);
    if (!doc) {
      doc = this.loadOrCreate(documentId);
      this.docs.set(documentId, doc);
      // Track dirty state on update.
      doc.on("update", () => {
        this.dirtyDocs.add(documentId);
      });
    }
    return doc;
  }

  /** Load a Yjs document from SQLite or create a fresh one. */
  private loadOrCreate(documentId: string): Y.Doc {
    const row = this.db.get<{ yjs_state: string }>(
      "SELECT yjs_state FROM crdt_documents WHERE document_id = ?",
      [documentId]
    );

    const doc = new Y.Doc();
    if (row?.yjs_state) {
      const state = Buffer.from(row.yjs_state, "base64");
      Y.applyUpdate(doc, new Uint8Array(state));
    }
    return doc;
  }

  /** Encode a Yjs document to a base64 state string. */
  private encodeState(doc: Y.Doc): string {
    const state = Y.encodeStateAsUpdate(doc);
    return Buffer.from(state).toString("base64");
  }

  /** Get the current state vector as base64. */
  getStateVector(documentId: string): string {
    const doc = this.docs.get(documentId);
    if (!doc) {
      // Load just the state vector from DB without keeping doc in memory.
      const row = this.db.get<{ yjs_state: string }>(
        "SELECT yjs_state FROM crdt_documents WHERE document_id = ?",
        [documentId]
      );
      return row?.yjs_state ?? "";
    }
    return Buffer.from(Y.encodeStateVector(doc)).toString("base64");
  }

  /** Merge a remote update into a Yjs document. Returns true if content changed. */
  applyUpdate(documentId: string, updateBase64: string): boolean {
    const doc = this.getDoc(documentId);
    const update = new Uint8Array(Buffer.from(updateBase64, "base64"));
    const prevLen = Y.encodeStateAsUpdate(doc).length;
    Y.applyUpdate(doc, update);
    const newLen = Y.encodeStateAsUpdate(doc).length;
    this.dirtyDocs.add(documentId);
    return newLen !== prevLen;
  }

  /** Get the document content as plain text. */
  getDocumentContent(documentId: string): string {
    const doc = this.getDoc(documentId);
    const yText = doc.getText("content");
    return yText.toString();
  }

  /** Get document metadata as a plain object. */
  getDocumentMetadata(documentId: string): Record<string, unknown> {
    const doc = this.getDoc(documentId);
    const yMap = doc.getMap("metadata");
    return yMap.toJSON() as Record<string, unknown>;
  }

  /** Get the version clock for a document. */
  getVersionClock(documentId: string): number {
    const row = this.db.get<{ version_clock: number }>(
      "SELECT version_clock FROM crdt_documents WHERE document_id = ?",
      [documentId]
    );
    return row?.version_clock ?? 0;
  }

  /** Flush all dirty documents to SQLite. */
  async flush(): Promise<void> {
    if (this.dirtyDocs.size === 0) return;

    const toFlush = [...this.dirtyDocs];
    this.dirtyDocs.clear();

    for (const documentId of toFlush) {
      const doc = this.docs.get(documentId);
      if (!doc) continue;
      const state = this.encodeState(doc);
      this.db.exec(
        `INSERT INTO crdt_documents (document_id, yjs_state, version_clock, updated_at)
         VALUES (?, ?, 1, datetime('now'))
         ON CONFLICT(document_id) DO UPDATE SET
           yjs_state = excluded.yjs_state,
           version_clock = version_clock + 1,
           updated_at = datetime('now')`,
        [documentId, state]
      );
    }
  }

  /** Destroy a specific document and release memory. */
  destroyDoc(documentId: string): void {
    const doc = this.docs.get(documentId);
    if (doc) {
      doc.destroy();
      this.docs.delete(documentId);
      this.dirtyDocs.delete(documentId);
    }
  }

  /** Shutdown: flush and destroy all documents. */
  async shutdown(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    await this.flush();
    for (const [id, doc] of this.docs) {
      doc.destroy();
      this.docs.delete(id);
    }
    this.dirtyDocs.clear();
  }
}
