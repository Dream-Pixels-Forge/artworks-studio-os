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

  /** All relationships in the graph (for full visualization). */
  allRelationships(): Relationship[] {
    const rows = this.db.all<RelationshipRow>(
      "SELECT * FROM relationships ORDER BY created_at DESC",
    );
    return rows.map((r) => ({ source: r.source_uuid, target: r.target_uuid, type: r.type }));
  }

  /** All entities that appear as nodes in the graph (either source or target of a relationship). */
  allGraphEntities(): Array<{ uuid: string; name: string; type: string; status: string }> {
    return this.db.all<{ uuid: string; name: string; type: string; status: string }>(
      `SELECT DISTINCT e.uuid, e.name, e.type, e.status
       FROM entities e
       INNER JOIN relationships r ON e.uuid = r.source_uuid OR e.uuid = r.target_uuid
       ORDER BY e.type, e.name`,
    );
  }

  /** All neighbors (both incoming and outgoing) of a given entity. */
  neighbors(uuid: string): Relationship[] {
    const rows = this.db.all<RelationshipRow>(
      `SELECT * FROM relationships
       WHERE source_uuid = ? OR target_uuid = ?
       ORDER BY created_at DESC`,
      [uuid, uuid],
    );
    return rows.map((r) => ({ source: r.source_uuid, target: r.target_uuid, type: r.type }));
  }

  /** BFS shortest path between two entities. Returns null if no path exists. */
  shortestPath(from: string, to: string): string[] | null {
    if (from === to) return [from];
    const visited = new Set<string>([from]);
    const queue: Array<{ node: string; path: string[] }> = [{ node: from, path: [from] }];
    while (queue.length > 0) {
      const { node, path } = queue.shift()!;
      const edges = this.db.all<{ target_uuid: string }>(
        "SELECT target_uuid FROM relationships WHERE source_uuid = ?",
        [node],
      );
      for (const edge of edges) {
        if (edge.target_uuid === to) return [...path, edge.target_uuid];
        if (!visited.has(edge.target_uuid)) {
          visited.add(edge.target_uuid);
          queue.push({ node: edge.target_uuid, path: [...path, edge.target_uuid] });
        }
      }
      const reverseEdges = this.db.all<{ source_uuid: string }>(
        "SELECT source_uuid FROM relationships WHERE target_uuid = ?",
        [node],
      );
      for (const edge of reverseEdges) {
        if (edge.source_uuid === to) return [...path, edge.source_uuid];
        if (!visited.has(edge.source_uuid)) {
          visited.add(edge.source_uuid);
          queue.push({ node: edge.source_uuid, path: [...path, edge.source_uuid] });
        }
      }
    }
    return null;
  }

  /** Subgraph around an entity (all entities within N hops). */
  subgraph(uuid: string, maxHops: number = 2): { entities: Array<{ uuid: string; name: string; type: string; status: string }>; relationships: Relationship[] } {
    const visited = new Set<string>([uuid]);
    let frontier = [uuid];
    for (let hop = 0; hop < maxHops; hop++) {
      const nextFrontier: string[] = [];
      for (const node of frontier) {
        const edges = this.db.all<RelationshipRow>(
          "SELECT * FROM relationships WHERE source_uuid = ? OR target_uuid = ?",
          [node, node],
        );
        for (const e of edges) {
          const neighbor = e.source_uuid === node ? e.target_uuid : e.source_uuid;
          if (!visited.has(neighbor)) {
            visited.add(neighbor);
            nextFrontier.push(neighbor);
          }
        }
      }
      frontier = nextFrontier;
    }
    const entities = this.db.all<{ uuid: string; name: string; type: string; status: string }>(
      `SELECT uuid, name, type, status FROM entities WHERE uuid IN (${Array.from(visited).map(() => "?").join(",")})`,
      [...visited],
    );
    const relationships = this.allRelationships().filter(
      (r) => visited.has(r.source) && visited.has(r.target),
    );
    return { entities, relationships };
  }
}
