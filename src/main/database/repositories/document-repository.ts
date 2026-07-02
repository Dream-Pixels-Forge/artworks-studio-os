/**
 * Document repository.
 *
 * Documents span `entities` + `documents` (project_uuid, doc_type, content).
 * The production bibles (story, character, environment, ...) are documents.
 */
import type { Entity } from "@shared/models/index.js";
import type { StudioDatabase } from "../db.js";
import { EntityRepository } from "./entity-repository.js";
import { entityRowToEntity, type EntityRow } from "../entity-mapper.js";

interface DocumentRow {
  project_uuid: string | null;
  doc_type: string;
  content: string;
}

/** A document entity, with the type-specific columns joined in. */
export interface Document extends Entity {
  projectUuid?: string;
  docType: string;
  content: string;
}

export interface CreateDocumentInput {
  name: string;
  docType: string;
  content?: string;
  projectUuid?: string;
}

export class DocumentRepository {
  private readonly entities: EntityRepository;

  constructor(private readonly db: StudioDatabase) {
    this.entities = new EntityRepository(db);
  }

  create(input: CreateDocumentInput): Document {
    return this.db.transaction(() => {
      const now = new Date().toISOString();
      const uuid = crypto.randomUUID();
      const doc: Document = {
        uuid,
        id: this.entities.nextId("DOC", "document"),
        name: input.name,
        type: "document",
        status: "draft",
        version: 1,
        createdAt: now,
        updatedAt: now,
        tags: [],
        metadata: {},
        projectUuid: input.projectUuid,
        docType: input.docType,
        content: input.content ?? "",
      };
      this.entities.insertEntity(doc);
      this.db.exec(
        "INSERT INTO documents (uuid, project_uuid, doc_type, content) VALUES (?, ?, ?, ?)",
        [uuid, input.projectUuid ?? null, input.docType, input.content ?? ""],
      );
      return doc;
    });
  }

  findByUuid(uuid: string): Document | undefined {
    const row = this.db.get<EntityRow>("SELECT * FROM entities WHERE uuid = ? AND type = ?", [
      uuid,
      "document",
    ]);
    if (!row) return undefined;
    const typeRow = this.db.get<DocumentRow>("SELECT * FROM documents WHERE uuid = ?", [uuid]);
    if (!typeRow) return undefined;
    return {
      ...entityRowToEntity(row),
      projectUuid: typeRow.project_uuid ?? undefined,
      docType: typeRow.doc_type,
      content: typeRow.content,
    } as Document;
  }

  listByProject(projectUuid: string): Document[] {
    const rows = this.db.all<{ uuid: string }>(
      "SELECT uuid FROM documents WHERE project_uuid = ?",
      [projectUuid],
    );
    return rows
      .map((r) => this.findByUuid(r.uuid))
      .filter((d): d is Document => d !== undefined);
  }

  /** List all documents regardless of project, newest first. */
  listAll(): Document[] {
    const rows = this.db.all<EntityRow>(
      "SELECT * FROM entities WHERE type = ? ORDER BY updated_at DESC",
      ["document"],
    );
    return rows
      .map((row) => {
        const typeRow = this.db.get<DocumentRow>("SELECT * FROM documents WHERE uuid = ?", [row.uuid]);
        if (!typeRow) return undefined;
        return {
          ...entityRowToEntity(row),
          projectUuid: typeRow.project_uuid ?? undefined,
          docType: typeRow.doc_type,
          content: typeRow.content,
        } as Document;
      })
      .filter((d): d is Document => d !== undefined);
  }

  update(doc: Document): void {
    this.db.transaction(() => {
      this.entities.updateEntity({ ...doc, updatedAt: new Date().toISOString() });
      this.db.exec(
        "UPDATE documents SET project_uuid = ?, doc_type = ?, content = ? WHERE uuid = ?",
        [doc.projectUuid ?? null, doc.docType, doc.content, doc.uuid],
      );
    });
  }

  delete(uuid: string): void {
    this.entities.deleteByUuid(uuid);
  }
}
