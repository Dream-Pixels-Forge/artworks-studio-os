/**
 * Graph repository (knowledge-graph edges).
 *
 * Backs the SDK's GraphService. Edges live in the `relationships` table:
 * (source_uuid, target_uuid, type, properties). Unique on the triple, so
 * connecting the same pair twice with the same type is a no-op-by-error.
 */
import type { StudioDatabase } from "../db.js";

export interface RelationshipRow {
  id: number;
  source_uuid: string;
  target_uuid: string;
  type: string;
  properties: string;
  created_at: string;
}

export interface Relationship {
  source: string;
  target: string;
  type: string;
}

export class GraphRepository {
  constructor(private readonly db: StudioDatabase) {}

  /** Create an edge. Idempotent: re-connecting the same triple is ignored. */
  connect(source: string, target: string, type: string): void {
    this.db.exec(
      `INSERT OR IGNORE INTO relationships (source_uuid, target_uuid, type)
       VALUES (?, ?, ?)`,
      [source, target, type],
    );
  }

  /** All edges originating from `from`. */
  relationships(from: string): Relationship[] {
    const rows = this.db.all<RelationshipRow>(
      "SELECT * FROM relationships WHERE source_uuid = ? ORDER BY created_at DESC",
      [from],
    );
    return rows.map((r) => ({ source: r.source_uuid, target: r.target_uuid, type: r.type }));
  }

  /** Remove an edge. */
  disconnect(source: string, target: string, type: string): void {
    this.db.exec(
      "DELETE FROM relationships WHERE source_uuid = ? AND target_uuid = ? AND type = ?",
      [source, target, type],
    );
  }
}
