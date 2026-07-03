-- Phase 18.2: Notification Center
-- Centralized notification management with real-time alerts, unread tracking, cross-panel event bus.

CREATE TABLE IF NOT EXISTS notifications (
  uuid          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  type          TEXT NOT NULL CHECK (type IN (
    'info', 'warning', 'error', 'success',
    'task_assigned', 'task_completed', 'task_overdue',
    'approval_requested', 'approval_granted', 'approval_rejected',
    'comment_added', 'mention', 'lifecycle_transition',
    'agent_completed', 'agent_failed',
    'backup_completed', 'backup_failed',
    'system_health', 'system_error'
  )),
  title         TEXT NOT NULL,
  message       TEXT NOT NULL,
  source        TEXT,       -- 'system', 'production', 'agent', 'enterprise', etc.
  source_uuid   TEXT,       -- FK to the entity that triggered this notification.
  actor_uuid    TEXT,       -- Who triggered it (user or agent).
  read          INTEGER NOT NULL DEFAULT 0,
  dismissed     INTEGER NOT NULL DEFAULT 0,
  action_url    TEXT,       -- Optional deep-link to open in the app.
  metadata      TEXT,       -- JSON payload for type-specific data.
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  read_at       TEXT,
  dismissed_at  TEXT
);

CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_dismissed ON notifications(dismissed);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_source ON notifications(source, source_uuid);

CREATE TABLE IF NOT EXISTS notification_preferences (
  uuid          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_uuid     TEXT NOT NULL,
  type          TEXT NOT NULL,
  enabled       INTEGER NOT NULL DEFAULT 1,
  sound_enabled INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_uuid, type)
);
