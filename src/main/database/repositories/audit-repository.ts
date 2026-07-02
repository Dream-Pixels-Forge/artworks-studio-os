/**
 * Audit repository — tracks all significant actions in the system.
 *
 * Every create, update, delete, install, and configuration change is logged
 * with the acting user, resource, action, and optional details JSON.
 * Provides queries for filtering by user, action, resource, and time range.
 */
import type { StudioDatabase } from "../db.js";

export interface AuditEntry {
  uuid: string;
  user_uuid: string | null;
  action: string;
  resource_type: string;
  resource_uuid: string | null;
  details: string;
  ip_address: string;
  created_at: string;
}

export interface AuditEntryWithUser extends AuditEntry {
  user_display_name: string | null;
}

export class AuditRepository {
  constructor(private readonly db: StudioDatabase) {}

  log(input: {
    user_uuid?: string | null;
    action: string;
    resource_type: string;
    resource_uuid?: string | null;
    details?: Record<string, unknown>;
    ip_address?: string;
  }): AuditEntry {
    const uuid = crypto.randomUUID();
    this.db.exec(
      `INSERT INTO audit_log (uuid, user_uuid, action, resource_type, resource_uuid, details, ip_address)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        uuid,
        input.user_uuid ?? null,
        input.action,
        input.resource_type,
        input.resource_uuid ?? null,
        JSON.stringify(input.details ?? {}),
        input.ip_address ?? "",
      ],
    );
    return this.getByUuid(uuid)!;
  }

  getByUuid(uuid: string): AuditEntry | undefined {
    return this.db.get<AuditEntry>("SELECT * FROM audit_log WHERE uuid = ?", [uuid]);
  }

  list(filter?: {
    user_uuid?: string;
    action?: string;
    resource_type?: string;
    resource_uuid?: string;
    since?: string;
    until?: string;
    limit?: number;
    offset?: number;
  }): AuditEntryWithUser[] {
    const conditions: string[] = [];
    const values: unknown[] = [];
    if (filter?.user_uuid) { conditions.push("a.user_uuid = ?"); values.push(filter.user_uuid); }
    if (filter?.action) { conditions.push("a.action = ?"); values.push(filter.action); }
    if (filter?.resource_type) { conditions.push("a.resource_type = ?"); values.push(filter.resource_type); }
    if (filter?.resource_uuid) { conditions.push("a.resource_uuid = ?"); values.push(filter.resource_uuid); }
    if (filter?.since) { conditions.push("a.created_at >= ?"); values.push(filter.since); }
    if (filter?.until) { conditions.push("a.created_at <= ?"); values.push(filter.until); }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const limit = filter?.limit ?? 100;
    const offset = filter?.offset ?? 0;
    return this.db.all<AuditEntryWithUser>(
      `SELECT a.*, u.display_name as user_display_name
       FROM audit_log a
       LEFT JOIN users u ON u.uuid = a.user_uuid
       ${where}
       ORDER BY a.created_at DESC
       LIMIT ? OFFSET ?`,
      [...values, limit, offset],
    );
  }

  count(filter?: {
    user_uuid?: string;
    action?: string;
    resource_type?: string;
    since?: string;
    until?: string;
  }): number {
    const conditions: string[] = [];
    const values: unknown[] = [];
    if (filter?.user_uuid) { conditions.push("user_uuid = ?"); values.push(filter.user_uuid); }
    if (filter?.action) { conditions.push("action = ?"); values.push(filter.action); }
    if (filter?.resource_type) { conditions.push("resource_type = ?"); values.push(filter.resource_type); }
    if (filter?.since) { conditions.push("created_at >= ?"); values.push(filter.since); }
    if (filter?.until) { conditions.push("created_at <= ?"); values.push(filter.until); }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const row = this.db.get<{ c: number }>(`SELECT COUNT(*) as c FROM audit_log ${where}`, values);
    return row?.c ?? 0;
  }

  deleteOlderThan(date: string): number {
    const row = this.db.get<{ c: number }>(
      "SELECT COUNT(*) as c FROM audit_log WHERE created_at < ?",
      [date],
    );
    const count = row?.c ?? 0;
    this.db.exec("DELETE FROM audit_log WHERE created_at < ?", [date]);
    return count;
  }

  // ── Stats ──────────────────────────────────────────────────

  stats(): {
    total: number;
    today: number;
    byAction: Record<string, number>;
    byResource: Record<string, number>;
    byUser: Array<{ user_uuid: string | null; count: number }>;
  } {
    const total = (this.db.get<{ c: number }>("SELECT COUNT(*) as c FROM audit_log") ?? { c: 0 }).c;
    const today = (this.db.get<{ c: number }>(
      "SELECT COUNT(*) as c FROM audit_log WHERE created_at >= date('now')",
    ) ?? { c: 0 }).c;

    const actionRows = this.db.all<{ action: string; c: number }>(
      "SELECT action, COUNT(*) as c FROM audit_log GROUP BY action ORDER BY c DESC",
    );
    const byAction: Record<string, number> = {};
    for (const row of actionRows) byAction[row.action] = row.c;

    const resourceRows = this.db.all<{ resource_type: string; c: number }>(
      "SELECT resource_type, COUNT(*) as c FROM audit_log GROUP BY resource_type ORDER BY c DESC",
    );
    const byResource: Record<string, number> = {};
    for (const row of resourceRows) byResource[row.resource_type] = row.c;

    const userRows = this.db.all<{ user_uuid: string | null; c: number }>(
      "SELECT user_uuid, COUNT(*) as c FROM audit_log GROUP BY user_uuid ORDER BY c DESC LIMIT 10",
    );
    const byUser = userRows.map((r) => ({ user_uuid: r.user_uuid, count: r.c }));

    return { total, today, byAction, byResource, byUser };
  }
}
