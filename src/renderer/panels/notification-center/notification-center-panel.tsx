/**
 * Notification Center panel.
 *
 * Real-time notification management: unread tracking, filtering, bulk actions,
 * and stats overview. Shows a live badge in the panel title.
 */
import React, { useCallback, useEffect, useState, type ReactElement } from "react";


type NotificationType =
  | "info" | "warning" | "error" | "success"
  | "task_assigned" | "task_completed" | "task_overdue"
  | "approval_requested" | "approval_granted" | "approval_rejected"
  | "comment_added" | "mention" | "lifecycle_transition"
  | "agent_completed" | "agent_failed"
  | "backup_completed" | "backup_failed"
  | "system_health" | "system_error";

interface Notification {
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

const TYPE_COLORS: Record<string, string> = {
  info: "#3b82f6",
  warning: "#f59e0b",
  error: "#ef4444",
  success: "#10b981",
  task_assigned: "#6366f1",
  task_completed: "#10b981",
  task_overdue: "#ef4444",
  approval_requested: "#8b5cf6",
  approval_granted: "#10b981",
  approval_rejected: "#ef4444",
  comment_added: "#3b82f6",
  mention: "#f59e0b",
  lifecycle_transition: "#06b6d4",
  agent_completed: "#10b981",
  agent_failed: "#ef4444",
  backup_completed: "#10b981",
  backup_failed: "#ef4444",
  system_health: "#3b82f6",
  system_error: "#ef4444",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const styles: Record<string, any> = {
  root: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    fontFamily: "var(--font-family, system-ui, sans-serif)",
    fontSize: "var(--font-size, 13px)",
    color: "var(--text-primary, #e5e5e5)",
    backgroundColor: "var(--bg-primary, #1a1a2e)",
  },
  toolbar: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 12px",
    borderBottom: "1px solid var(--border-color, #333)",
    flexShrink: 0,
  },
  badge: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 20,
    height: 20,
    padding: "0 6px",
    borderRadius: 10,
    backgroundColor: "#ef4444",
    color: "#fff",
    fontSize: 11,
    fontWeight: 600,
  },
  filterGroup: {
    display: "flex",
    gap: 4,
    flexWrap: "wrap" as const,
  },
  filterBtn: {
    padding: "3px 8px",
    borderRadius: 4,
    border: "1px solid var(--border-color, #333)",
    background: "transparent",
    color: "var(--text-secondary, #999)",
    fontSize: 11,
    cursor: "pointer",
  },
  filterBtnActive: {
    padding: "3px 8px",
    borderRadius: 4,
    border: "1px solid #6366f1",
    background: "rgba(99, 102, 241, 0.15)",
    color: "#6366f1",
    fontSize: 11,
    cursor: "pointer",
  },
  actionBtn: {
    padding: "3px 8px",
    borderRadius: 4,
    border: "none",
    background: "var(--accent, #6366f1)",
    color: "#fff",
    fontSize: 11,
    cursor: "pointer",
    marginLeft: "auto",
  },
  list: {
    flex: 1,
    overflowY: "auto" as const,
    padding: 0,
  },
  item: (unread: boolean) => ({
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
    padding: "10px 12px",
    borderBottom: "1px solid var(--border-color, #333)",
    backgroundColor: unread ? "rgba(99, 102, 241, 0.05)" : "transparent",
    cursor: "pointer",
    transition: "background-color 0.15s",
  }),
  dot: (type: string) => ({
    width: 8,
    height: 8,
    borderRadius: "50%",
    backgroundColor: TYPE_COLORS[type] || "#666",
    marginTop: 4,
    flexShrink: 0,
  }),
  content: {
    flex: 1,
    minWidth: 0,
  },
  title: (unread: boolean) => ({
    fontSize: 12,
    fontWeight: unread ? 600 : 400,
    color: "var(--text-primary, #e5e5e5)",
    marginBottom: 2,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap" as const,
  }),
  message: {
    fontSize: 11,
    color: "var(--text-secondary, #999)",
    lineHeight: 1.4,
    overflow: "hidden",
    textOverflow: "ellipsis",
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical" as const,
  },
  meta: {
    fontSize: 10,
    color: "var(--text-tertiary, #666)",
    marginTop: 3,
    display: "flex",
    gap: 8,
  },
  empty: {
    padding: 40,
    textAlign: "center" as const,
    color: "var(--text-tertiary, #666)",
    fontSize: 13,
  },
  statsBar: {
    display: "flex",
    gap: 16,
    padding: "8px 12px",
    borderTop: "1px solid var(--border-color, #333)",
    fontSize: 11,
    color: "var(--text-secondary, #999)",
    flexShrink: 0,
  },
  statItem: {
    display: "flex",
    alignItems: "center",
    gap: 4,
  },
};

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  return `${diffD}d ago`;
}

export function NotificationCenterPanel(): ReactElement {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [filter, setFilter] = useState<{ read?: boolean; type?: string }>({ read: false });
  const [unreadCount, setUnreadCount] = useState(0);
  const [stats, setStats] = useState<{
    total: number; unread: number;
    byType: Record<string, number>; todayCount: number;
  } | null>(null);

  const refresh = useCallback(async () => {
    try {
      const items = await window.artworks.notification.list(filter) as Notification[];
      setNotifications(items);
      const uc = await window.artworks.notification["unread-count"]() as { count: number };
      setUnreadCount(uc.count);
      const s = await window.artworks.notification.stats() as typeof stats;
      setStats(s);
    } catch {
      /* panel not wired yet */
    }
  }, [filter]);

  useEffect(() => { refresh(); }, [refresh]);

  // Poll every 10s
  useEffect(() => {
    const interval = setInterval(refresh, 10000);
    return () => clearInterval(interval);
  }, [refresh]);

  const markRead = async (uuid: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await window.artworks.notification["mark-read"](uuid);
    refresh();
  };

  const dismiss = async (uuid: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await window.artworks.notification.dismiss(uuid);
    refresh();
  };

  return (
    <div style={styles.root}>
        <div style={styles.toolbar}>
          {unreadCount > 0 && <span style={styles.badge}>{unreadCount}</span>}
          <div style={styles.filterGroup}>
            <button
              style={filter.read === false ? styles.filterBtnActive : styles.filterBtn}
              onClick={() => setFilter({ read: false })}
            >
              Unread
            </button>
            <button
              style={filter.read === undefined ? styles.filterBtnActive : styles.filterBtn}
              onClick={() => setFilter({})}
            >
              All
            </button>
            <button
              style={filter.read === true ? styles.filterBtnActive : styles.filterBtn}
              onClick={() => setFilter({ read: true })}
            >
              Read
            </button>
          </div>
          {unreadCount > 0 && (
            <button style={styles.actionBtn} onClick={async () => {
              await window.artworks.notification["mark-all-read"]();
              refresh();
            }}>
              Mark all read
            </button>
          )}
        </div>

        <div style={styles.list}>
          {notifications.length === 0 ? (
            <div style={styles.empty}>
              {filter.read === false ? "No unread notifications" : "No notifications"}
            </div>
          ) : (
            notifications.map(n => (
              <div key={n.uuid} style={styles.item(n.read === 0)} onClick={(e) => markRead(n.uuid, e)}>
                <div style={styles.dot(n.type)} />
                <div style={styles.content}>
                  <div style={styles.title(n.read === 0)}>{n.title}</div>
                  <div style={styles.message}>{n.message}</div>
                  <div style={styles.meta}>
                    <span>{n.source ?? "system"}</span>
                    <span>{timeAgo(n.created_at)}</span>
                    {n.read === 0 && (
                      <button
                        style={{ background: "none", border: "none", color: "#6366f1", cursor: "pointer", fontSize: 10, padding: 0 }}
                        onClick={(e) => dismiss(n.uuid, e)}
                      >
                        dismiss
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {stats && (
          <div style={styles.statsBar}>
            <div style={styles.statItem}>
              <span>Total: {stats.total}</span>
            </div>
            <div style={styles.statItem}>
              <span>Today: {stats.todayCount}</span>
            </div>
            <div style={styles.statItem}>
              <span>Unread: {stats.unread}</span>
            </div>
          </div>
        )}
      </div>
  );
}
