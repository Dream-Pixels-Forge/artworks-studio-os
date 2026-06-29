/**
 * Generic repository over the `entities` table.
 *
 * Owns the fields every entity shares (uuid, id, name, status, version,
 * tags, metadata, timestamps). Type-specific repositories compose this and
 * add the type-table columns. CRUD here is the uniform foundation; typed
 * reads (which require joining the type table) live in the type repos.
 */
import type { Entity, EntityStatus } from "@shared/models/index.js";
import type { StudioDatabase } from "../db.js";
import { entityRowToEntity, entityToInsertParams, entityToUpdateParams, type EntityRow } from "../entity-mapper.js";

const INSERT_SQL = `
  INSERT INTO entities (uuid, id, name, type, status, version, created_at, updated_at, owner, tags, metadata)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`;

const UPDATE_SQL = `
  UPDATE entities
  SET status = ?, version = ?, updated_at = ?, owner = ?, tags = ?, metadata = ?
  WHERE uuid = ?
`;

export class EntityRepository {
  constructor(private readonly db: StudioDatabase) {}

  /** Insert an entity row. Used by type repos inside a transaction. */
  insertEntity(entity: Entity): void {
    this.db.exec(INSERT_SQL, entityToInsertParams(entity));
  }

  /** Read the base entity by uuid (no type-specific fields). */
  findByUuid(uuid: string): Entity | undefined {
    const row = this.db.get<EntityRow>("SELECT * FROM entities WHERE uuid = ?", [uuid]);
    return row ? entityRowToEntity(row) : undefined;
  }

  /** Read the base entity by human id + type. */
  findById(id: string, type: string): Entity | undefined {
    const row = this.db.get<EntityRow>(
      "SELECT * FROM entities WHERE id = ? AND type = ?",
      [id, type],
    );
    return row ? entityRowToEntity(row) : undefined;
  }

  /** List base entities of a type, newest first. */
  listByType(type: string): Entity[] {
    const rows = this.db.all<EntityRow>(
      "SELECT * FROM entities WHERE type = ? ORDER BY updated_at DESC",
      [type],
    );
    return rows.map(entityRowToEntity);
  }

  /** Update the generic fields of an entity (never uuid/id/name/type/created_at). */
  updateEntity(entity: Entity): void {
    this.db.exec(UPDATE_SQL, entityToUpdateParams(entity));
  }

  /** Delete an entity; cascades to all type tables via FK ON DELETE CASCADE. */
  deleteByUuid(uuid: string): void {
    this.db.exec("DELETE FROM entities WHERE uuid = ?", [uuid]);
  }

  /** Full-text search over entity name/type/metadata. Returns base entities. */
  search(query: string): Entity[] {
    const rows = this.db.all<EntityRow>(
      `SELECT e.* FROM entities_fts
       JOIN entities e ON e.uuid = entities_fts.uuid
       WHERE entities_fts MATCH ?
       ORDER BY rank`,
      [query],
    );
    return rows.map(entityRowToEntity);
  }

  /** Count entities of a type (for ID minting). */
  countByType(type: string): number {
    const row = this.db.get<{ count: number }>(
      "SELECT COUNT(*) AS count FROM entities WHERE type = ?",
      [type],
    );
    return row?.count ?? 0;
  }

  /** Mint the next human id for a type, e.g. "CHR-001". */
  nextId(prefix: string, type: string): string {
    const count = this.countByType(type);
    return `${prefix}-${String(count + 1).padStart(3, "0")}`;
  }

  /** Patch a subset of entity fields (convenience for status changes). */
  patchStatus(uuid: string, status: EntityStatus): void {
    this.db.exec(
      "UPDATE entities SET status = ?, updated_at = datetime('now') WHERE uuid = ?",
      [status, uuid],
    );
  }
}
