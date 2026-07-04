/**
 * Notification repository — CRUD + unread tracking + stats for the
 * Notification Center (Phase 18.2).
 */
import type { StudioDatabase } from "../db.js";

export type NotificationType =
  | "info" | "warning" | "error" | "success"
  | "task_assigned" | "task_completed" | "task_overdue"
  | "approval_requested" | "approval_granted" | "approval_rejected"
  | "comment_added" | "mention" | "lifecycle_transition"
  | "agent_completed" | "agent_failed"
  | "backup_completed" | "backup_failed"
  | "system_health" | "system_error";

export interface Notification {
  uuid: string;
  type: NotificationType;
  title: string;
  message: string;
  source: string | null;
  source_uuid: string | null;
  actor_uuid: string | null;
  read: number;
  dismissed: number;
  action_url: string | null;
  metadata: string | null;
  created_at: string;
  read_at: string | null;
  dismissed_at: string | null;
}

export interface NotificationFilter {
  type?: NotificationType;
  source?: string;
  read?: boolean;
  dismissed?: boolean;
  since?: string;
  limit?: number;
}

export interface NotificationStats {
  total: number;
  unread: number;
  unDismissed: number;
  byType: Record<string, number>;
  bySource: Record<string, number>;
  todayCount: number;
  oldestUnreadAge: number | null;
}

export class NotificationRepository {
  private db: StudioDatabase;

  constructor(db: StudioDatabase) {
    this.db = db;
  }

  create(input: {
    type: NotificationType;
    title: string;
    message: string;
    source?: string;
    source_uuid?: string;
    actor_uuid?: string;
    action_url?: string;
    metadata?: Record<string, unknown>;
  }): Notification {
    const uuid = crypto.randomUUID().replace(/-/g, "").slice(0, 32);
    this.db.prepare(`
      INSERT INTO notifications (uuid, type, title, message, source, source_uuid, actor_uuid, action_url, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      uuid,
      input.type,
      input.title,
      input.message,
      input.source ?? null,
      input.source_uuid ?? null,
      input.actor_uuid ?? null,
      input.action_url ?? null,
      input.metadata ? JSON.stringify(input.metadata) : null,
    );
    return this.getByUuid(uuid)!;
  }

  getByUuid(uuid: string): Notification | undefined {
    return this.db.prepare("SELECT * FROM notifications WHERE uuid = ?").get(uuid) as Notification | undefined;
  }

  list(filter: NotificationFilter = {}): Notification[] {
    let sql = "SELECT * FROM notifications WHERE 1=1";
    const params: unknown[] = [];

    if (filter.type) { sql += " AND type = ?"; params.push(filter.type); }
    if (filter.source) { sql += " AND source = ?"; params.push(filter.source); }
    if (filter.read !== undefined) { sql += " AND read = ?"; params.push(filter.read ? 1 : 0); }
    if (filter.dismissed !== undefined) { sql += " AND dismissed = ?"; params.push(filter.dismissed ? 1 : 0); }
    if (filter.since) { sql += " AND created_at >= ?"; params.push(filter.since); }

    sql += " ORDER BY created_at DESC";

    if (filter.limit && filter.limit > 0) { sql += " LIMIT ?"; params.push(filter.limit); }

    return this.db.prepare(sql).all(...params) as Notification[];
  }

  markRead(uuid: string): Notification | undefined {
    this.db.prepare(`
      UPDATE notifications SET read = 1, read_at = datetime('now') WHERE uuid = ? AND read = 0
    `).run(uuid);
    return this.getByUuid(uuid);
  }

  markAllRead(): number {
    const result = this.db.prepare(`
      UPDATE notifications SET read = 1, read_at = datetime('now') WHERE read = 0
    `).run();
    return result.changes;
  }

  dismiss(uuid: string): Notification | undefined {
    this.db.prepare(`
      UPDATE notifications SET dismissed = 1, dismissed_at = datetime('now') WHERE uuid = ? AND dismissed = 0
    `).run(uuid);
    return this.getByUuid(uuid);
  }

  dismissAll(): number {
    const result = this.db.prepare(`
      UPDATE notifications SET dismissed = 1, dismissed_at = datetime('now') WHERE dismissed = 0
    `).run();
    return result.changes;
  }

  delete(uuid: string): boolean {
    const result = this.db.prepare("DELETE FROM notifications WHERE uuid = ?").run(uuid);
    return result.changes > 0;
  }

  getUnreadCount(): number {
    const row = this.db.prepare("SELECT COUNT(*) as count FROM notifications WHERE read = 0 AND dismissed = 0").get() as { count: number };
    return row.count;
  }

  getStats(): NotificationStats {
    const total = (this.db.prepare("SELECT COUNT(*) as count FROM notifications").get() as { count: number }).count;
    const unread = (this.db.prepare("SELECT COUNT(*) as count FROM notifications WHERE read = 0").get() as { count: number }).count;
    const unDismissed = (this.db.prepare("SELECT COUNT(*) as count FROM notifications WHERE dismissed = 0").get() as { count: number }).count;
    const todayCount = (this.db.prepare(`
      SELECT COUNT(*) as count FROM notifications WHERE created_at >= date('now')
    `).get() as { count: number }).count;

    const byTypeRows = this.db.prepare(`
      SELECT type, COUNT(*) as count FROM notifications GROUP BY type
    `).all() as Array<{ type: string; count: number }>;
    const byType: Record<string, number> = {};
    for (const row of byTypeRows) { byType[row.type] = row.count; }

    const bySourceRows = this.db.prepare(`
      SELECT COALESCE(source, 'unknown') as source, COUNT(*) as count FROM notifications GROUP BY source
    `).all() as Array<{ source: string; count: number }>;
    const bySource: Record<string, number> = {};
    for (const row of bySourceRows) { bySource[row.source] = row.count; }

    const oldestUnreadRow = this.db.prepare(`
      SELECT created_at FROM notifications WHERE read = 0 ORDER BY created_at ASC LIMIT 1
    `).get() as { created_at: string } | undefined;

    let oldestUnreadAge: number | null = null;
    if (oldestUnreadRow) {
      const created = new Date(oldestUnreadRow.created_at).getTime();
      oldestUnreadAge = Math.floor((Date.now() - created) / 1000 / 60);
    }

    return { total, unread, unDismissed, byType, bySource, todayCount, oldestUnreadAge };
  }
}
