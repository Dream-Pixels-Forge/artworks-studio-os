/**
 * CrdtService tests.
 *
 * Exercises the Yjs-based CRDT service against an in-memory migrated
 * database. Covers document lifecycle, content/metadata access, SQLite
 * persistence, remote update merging, version clocking, and shutdown.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { StudioDatabase } from "../database/db.js";
import { MIGRATIONS } from "../database/migrations.js";
import { CrdtService } from "./crdt-service.js";
import * as Y from "yjs";

let db: StudioDatabase;
let service: CrdtService;

beforeAll(async () => {
  db = await StudioDatabase.openInMemory(MIGRATIONS);
  service = new CrdtService(db);
  await service.init();
});

afterAll(async () => {
  await service.shutdown();
  db.close();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DOC_ID = "test-doc-001";
const DOC_ID_2 = "test-doc-002";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("CrdtService", () => {
  describe("init", () => {
    it("creates the crdt_documents table", async () => {
      const row = db.get<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='crdt_documents'"
      );
      expect(row).toBeDefined();
      expect(row?.name).toBe("crdt_documents");
    });

    it("creates an index on document_id", () => {
      const row = db.get<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type='index' AND name='idx_crdt_documents_document_id'"
      );
      expect(row).toBeDefined();
    });
  });

  describe("getDoc", () => {
    it("creates a fresh empty Y.Doc for a new documentId", () => {
      const doc = service.getDoc(DOC_ID);
      expect(doc).toBeInstanceOf(Y.Doc);
      // Fresh doc should have empty content.
      const text = doc.getText("content");
      expect(text.toString()).toBe("");
    });

    it("returns the same doc instance on subsequent calls (cached)", () => {
      const doc1 = service.getDoc(DOC_ID);
      const doc2 = service.getDoc(DOC_ID);
      expect(doc1).toBe(doc2);
    });
  });

  describe("getDocumentContent", () => {
    it("returns empty string for a fresh doc", () => {
      const content = service.getDocumentContent(DOC_ID);
      expect(content).toBe("");
    });

    it("returns text after editing the Y.Text", () => {
      const doc = service.getDoc(DOC_ID);
      const yText = doc.getText("content");
      yText.insert(0, "Hello, CRDT!");

      const content = service.getDocumentContent(DOC_ID);
      expect(content).toBe("Hello, CRDT!");
    });

    it("accumulates multiple inserts", () => {
      const doc = service.getDoc(DOC_ID);
      const yText = doc.getText("content");
      yText.insert(12, " World");

      expect(service.getDocumentContent(DOC_ID)).toBe("Hello, CRDT! World");
    });
  });

  describe("getDocumentMetadata", () => {
    it("returns empty object for a fresh doc", () => {
      const meta = service.getDocumentMetadata(DOC_ID_2);
      expect(meta).toEqual({});
    });

    it("returns values set in the Y.Map", () => {
      const doc = service.getDoc(DOC_ID_2);
      const yMap = doc.getMap("metadata");
      yMap.set("title", "Test Asset");
      yMap.set("tags", ["film", "vfx"]);

      const meta = service.getDocumentMetadata(DOC_ID_2);
      expect(meta.title).toBe("Test Asset");
      expect(meta.tags).toEqual(["film", "vfx"]);
    });
  });

  describe("flush", () => {
    it("persists dirty docs to SQLite", async () => {
      // Modify doc to mark dirty.
      const doc = service.getDoc(DOC_ID);
      doc.getText("content").insert(0, "flush-test");

      await service.flush();

      const row = db.get<{ document_id: string; yjs_state: string; version_clock: number }>(
        "SELECT document_id, yjs_state, version_clock FROM crdt_documents WHERE document_id = ?",
        [DOC_ID]
      );
      expect(row).toBeDefined();
      expect(row?.document_id).toBe(DOC_ID);
      expect(row?.yjs_state).toBeTruthy();
      expect(typeof row?.yjs_state).toBe("string");
    });

    it("is idempotent — flushing twice does not duplicate rows", async () => {
      await service.flush();

      const rows = db.all<{ document_id: string }>(
        "SELECT document_id FROM crdt_documents WHERE document_id = ?",
        [DOC_ID]
      );
      expect(rows).toHaveLength(1);
    });

    it("increments version_clock on subsequent flushes", async () => {
      // Modify doc again to mark dirty.
      const doc = service.getDoc(DOC_ID);
      doc.getText("content").insert(0, "v2");

      await service.flush();

      const row = db.get<{ version_clock: number }>(
        "SELECT version_clock FROM crdt_documents WHERE document_id = ?",
        [DOC_ID]
      );
      expect(row?.version_clock).toBe(2);
    });
  });

  describe("getDoc loads from SQLite", () => {
    it("restores document content from a flushed state", async () => {
      // Flush the current state.
      await service.flush();

      // Create a new service instance with the same database.
      const freshService = new CrdtService(db);

      // getDoc should load the persisted state.
      const content = freshService.getDocumentContent(DOC_ID);
      expect(content).toContain("flush-test");

      // Clean up the fresh service without shutting down our main one.
      freshService.destroyDoc(DOC_ID);
    });
  });

  describe("applyUpdate", () => {
    it("merges a remote update into a local doc", () => {
      // Create a separate source doc with different content.
      const sourceDoc = new Y.Doc();
      sourceDoc.getText("content").insert(0, "Remote content");

      // Encode the state as an update.
      const update = Y.encodeStateAsUpdate(sourceDoc);
      const updateBase64 = Buffer.from(update).toString("base64");

      // Apply to the service doc.
      const changed = service.applyUpdate(DOC_ID, updateBase64);
      expect(changed).toBe(true);

      const content = service.getDocumentContent(DOC_ID);
      expect(content).toContain("Remote content");

      sourceDoc.destroy();
    });

    it("returns true when content actually changes", () => {
      const sourceDoc = new Y.Doc();
      sourceDoc.getText("content").insert(0, "New data");

      const update = Y.encodeStateAsUpdate(sourceDoc);
      const updateBase64 = Buffer.from(update).toString("base64");

      const result = service.applyUpdate(DOC_ID, updateBase64);
      expect(result).toBe(true);

      sourceDoc.destroy();
    });

    it("returns false when applying the same state", () => {
      const doc = service.getDoc(DOC_ID);

      // Encode current state as an update and apply it back — no change.
      const currentState = Y.encodeStateAsUpdate(doc);
      const updateBase64 = Buffer.from(currentState).toString("base64");

      const result = service.applyUpdate(DOC_ID, updateBase64);
      expect(result).toBe(false);
    });
  });

  describe("getStateVector", () => {
    it("returns non-empty base64 string for a doc with content", () => {
      const sv = service.getStateVector(DOC_ID);
      expect(sv).toBeTruthy();
      expect(typeof sv).toBe("string");
      // Should be valid base64.
      const decoded = Buffer.from(sv, "base64");
      expect(decoded.length).toBeGreaterThan(0);
    });

    it("returns empty string for unknown document not in DB", () => {
      const sv = service.getStateVector("nonexistent-doc-id");
      expect(sv).toBe("");
    });
  });

  describe("getVersionClock", () => {
    it("returns 0 for a new doc not yet flushed", () => {
      const clock = service.getVersionClock("brand-new-doc");
      expect(clock).toBe(0);
    });

    it("increments after flushing", async () => {
      const doc = service.getDoc("clock-test-doc");
      doc.getText("content").insert(0, "tick");

      await service.flush();

      const clock = service.getVersionClock("clock-test-doc");
      expect(clock).toBe(1);

      // Flush again after another edit.
      doc.getText("content").insert(0, "tock");
      await service.flush();

      const clock2 = service.getVersionClock("clock-test-doc");
      expect(clock2).toBe(2);
    });
  });

  describe("destroyDoc", () => {
    it("removes the doc from memory and subsequent getDoc creates fresh", () => {
      const docId = "destroy-test-doc";
      const doc = service.getDoc(docId);
      doc.getText("content").insert(0, "will be destroyed");

      service.destroyDoc(docId);

      // Subsequent getDoc should create a new empty doc (not loaded from DB
      // since we never flushed it).
      const freshDoc = service.getDoc(docId);
      expect(freshDoc).not.toBe(doc);
      expect(freshDoc.getText("content").toString()).toBe("");
    });

    it("does nothing for an unknown documentId", () => {
      // Should not throw.
      expect(() => service.destroyDoc("unknown-doc")).not.toThrow();
    });
  });

  describe("shutdown", () => {
    it("flushes all docs and clears internal state", async () => {
      // Create a doc with content that hasn't been flushed.
      const doc = service.getDoc("shutdown-test-doc");
      doc.getText("content").insert(0, "shutdown-content");

      await service.shutdown();

      // Verify the doc was persisted.
      const row = db.get<{ document_id: string }>(
        "SELECT document_id FROM crdt_documents WHERE document_id = ?",
        ["shutdown-test-doc"]
      );
      expect(row).toBeDefined();
      expect(row?.document_id).toBe("shutdown-test-doc");

      // Create a new service to verify we can still access the data.
      const newService = new CrdtService(db);
      await newService.init();

      const content = newService.getDocumentContent("shutdown-test-doc");
      expect(content).toContain("shutdown-content");

      await newService.shutdown();
    });
  });
});
