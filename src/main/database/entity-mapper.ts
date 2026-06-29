/**
 * Entity row ↔ model mapper.
 *
 * The `entities` table uses snake_case columns and stores `tags`/`metadata`
 * as JSON text. The TS `Entity` model uses camelCase and native arrays/
 * objects. This module is the single bidirectional transform — pure
 * functions, no DB access, fully unit-testable.
 */
import type { Entity, EntityStatus } from "@shared/models/index.js";

/** The raw shape of an `entities` row as SQLite returns it. */
export interface EntityRow {
  uuid: string;
  id: string;
  name: string;
  type: string;
  status: string;
  version: number;
  created_at: string;
  updated_at: string;
  owner: string | null;
  tags: string; // JSON array string
  metadata: string; // JSON object string
}

/** Convert a DB row into a typed Entity (base, without type-specific fields). */
export function entityRowToEntity(row: EntityRow): Entity {
  return {
    uuid: row.uuid,
    id: row.id,
    name: row.name,
    type: row.type,
    status: row.status as EntityStatus,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    owner: row.owner ?? undefined,
    tags: parseJsonArray(row.tags),
    metadata: parseJsonObject(row.metadata),
  };
}

/** Build the positional params for an entities INSERT, from an Entity. */
export function entityToInsertParams(entity: Entity): unknown[] {
  return [
    entity.uuid,
    entity.id,
    entity.name,
    entity.type,
    entity.status,
    entity.version,
    entity.createdAt,
    entity.updatedAt,
    entity.owner ?? null,
    JSON.stringify(entity.tags),
    JSON.stringify(entity.metadata),
  ];
}

/** Build the positional params for an entities UPDATE, from an Entity. */
export function entityToUpdateParams(entity: Entity): unknown[] {
  return [
    entity.status,
    entity.version,
    entity.updatedAt,
    entity.owner ?? null,
    JSON.stringify(entity.tags),
    JSON.stringify(entity.metadata),
    entity.uuid,
  ];
}

function parseJsonArray(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function parseJsonObject(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}
