/**
 * Version history repository.
 *
 * Snapshots blocked at creation/update time so nothing is ever lost.
 * Writes go through a transaction; reads return the JSON snapshot
 * deserialized back to the caller's expected shape.
 */
import type { Entity } from "@shared/models/index.js";
import type { StudioDatabase } from "../db.js";

export interface VersionSnapshot {
  readonly id: number;
  readonly entityUuid: string;
  readonly version: number;
  readonly snapshot: Entity;
  readonly changedBy?: string;
  readonly changedAt: string;
}

export class VersionHistoryRepository {
  constructor(private readonly db: StudioDatabase) {}

  /** Record a snapshot of an entity at its current version. */
  record(entity: Entity, changedBy?: string): void {
    this.db.exec(
      `INSERT INTO version_history (entity_uuid, version, snapshot, changed_by)
       VALUES (?, ?, ?, ?)`,
      [entity.uuid, entity.version, JSON.stringify(entity), changedBy ?? null],
    );
  }

  /** List all recorded snapshots for an entity, newest first. */
  list(entityUuid: string): VersionSnapshot[] {
    const rows = this.db.all<{
      id: number;
      entity_uuid: string;
      version: number;
      snapshot: string;
      changed_by: string | null;
      changed_at: string;
    }>(
      "SELECT * FROM version_history WHERE entity_uuid = ? ORDER BY version DESC",
      [entityUuid],
    );
    return rows.map((r) => ({
      id: r.id,
      entityUuid: r.entity_uuid,
      version: r.version,
      snapshot: JSON.parse(r.snapshot) as Entity,
      changedBy: r.changed_by ?? undefined,
      changedAt: r.changed_at,
    }));
  }

  /** Get a specific version of an entity. */
  getVersion(entityUuid: string, version: number): VersionSnapshot | undefined {
    const row = this.db.get<{
      id: number;
      entity_uuid: string;
      version: number;
      snapshot: string;
      changed_by: string | null;
      changed_at: string;
    }>(
      "SELECT * FROM version_history WHERE entity_uuid = ? AND version = ?",
      [entityUuid, version],
    );
    if (!row) return undefined;
    return {
      id: row.id,
      entityUuid: row.entity_uuid,
      version: row.version,
      snapshot: JSON.parse(row.snapshot) as Entity,
      changedBy: row.changed_by ?? undefined,
      changedAt: row.changed_at,
    };
  }
}