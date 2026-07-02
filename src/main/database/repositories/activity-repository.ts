/**
 * Activity log repository.
 *
 * Records all user actions as audit trail entries in the `activity_log` table.
 */
import type { StudioDatabase } from "../db.js";

export type ActivityAction = "create" | "update" | "delete" | "comment" | "assign" | "status_change";

export interface ActivityEntry {
  uuid: string;
  userUuid?: string;
  entityUuid?: string;
  action: ActivityAction;
  entityType: string;
  details: Record<string, unknown>;
  createdAt: string;
}

interface ActivityRow {
  uuid: string;
  user_uuid: string | null;
  entity_uuid: string | null;
  action: string;
  entity_type: string;
  details: string;
  created_at: string;
}

export interface LogActivityInput {
  userUuid?: string;
  entityUuid?: string;
  action: ActivityAction;
  entityType: string;
  details?: Record<string, unknown>;
}

export interface ActivityFilter {
  userUuid?: string;
  entityUuid?: string;
  entityType?: string;
  action?: ActivityAction;
  since?: string;
}

export class ActivityRepository {
  constructor(private readonly db: StudioDatabase) {}

  log(input: LogActivityInput): ActivityEntry {
    const uuid = crypto.randomUUID();
    const now = new Date().toISOString();
    const entry: ActivityEntry = {
      uuid,
      userUuid: input.userUuid,
      entityUuid: input.entityUuid,
      action: input.action,
      entityType: input.entityType,
      details: input.details ?? {},
      createdAt: now,
    };
    this.db.exec(
      `INSERT INTO activity_log (uuid, user_uuid, entity_uuid, action, entity_type, details, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [uuid, input.userUuid ?? null, input.entityUuid ?? null, input.action, input.entityType, JSON.stringify(input.details ?? {}), now],
    );
    return entry;
  }

  findByUuid(uuid: string): ActivityEntry | undefined {
    const row = this.db.get<ActivityRow>("SELECT * FROM activity_log WHERE uuid = ?", [uuid]);
    return row ? this.toEntry(row) : undefined;
  }

  list(filter?: ActivityFilter, limit = 50): ActivityEntry[] {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filter?.userUuid) {
      conditions.push("user_uuid = ?");
      params.push(filter.userUuid);
    }
    if (filter?.entityUuid) {
      conditions.push("entity_uuid = ?");
      params.push(filter.entityUuid);
    }
    if (filter?.entityType) {
      conditions.push("entity_type = ?");
      params.push(filter.entityType);
    }
    if (filter?.action) {
      conditions.push("action = ?");
      params.push(filter.action);
    }
    if (filter?.since) {
      conditions.push("created_at >= ?");
      params.push(filter.since);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const rows = this.db.all<ActivityRow>(
      `SELECT * FROM activity_log ${where} ORDER BY created_at DESC LIMIT ?`,
      [...params, limit],
    );
    return rows.map((r) => this.toEntry(r));
  }

  count(filter?: ActivityFilter): number {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filter?.userUuid) {
      conditions.push("user_uuid = ?");
      params.push(filter.userUuid);
    }
    if (filter?.entityType) {
      conditions.push("entity_type = ?");
      params.push(filter.entityType);
    }
    if (filter?.action) {
      conditions.push("action = ?");
      params.push(filter.action);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const result = this.db.get<{ count: number }>(
      `SELECT COUNT(*) as count FROM activity_log ${where}`,
      params,
    );
    return result?.count ?? 0;
  }

  deleteOlderThan(days: number): number {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const result = this.db.get<{ count: number }>(
      "SELECT COUNT(*) as count FROM activity_log WHERE created_at < ?",
      [cutoff],
    );
    this.db.exec("DELETE FROM activity_log WHERE created_at < ?", [cutoff]);
    return result?.count ?? 0;
  }

  private toEntry(row: ActivityRow): ActivityEntry {
    let details: Record<string, unknown> = {};
    try {
      details = JSON.parse(row.details) as Record<string, unknown>;
    } catch { /* ignore malformed JSON */ }
    return {
      uuid: row.uuid,
      userUuid: row.user_uuid ?? undefined,
      entityUuid: row.entity_uuid ?? undefined,
      action: row.action as ActivityAction,
      entityType: row.entity_type,
      details,
      createdAt: row.created_at,
    };
  }
}
