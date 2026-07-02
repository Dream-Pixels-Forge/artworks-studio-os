-- Artworks Studio OS — database schema v3
-- Phase 11: Collaboration
--
-- Adds users, activity log, and comments tables.

PRAGMA foreign_keys = ON;

-- ============================================================
-- Users — team members who can be assigned to tasks
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  uuid       TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  email      TEXT,
  avatar_url TEXT,
  role       TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
  is_active  INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_users_role ON users (role);
CREATE INDEX IF NOT EXISTS idx_users_active ON users (is_active);

-- ============================================================
-- Activity Log — audit trail of all changes
-- ============================================================
CREATE TABLE IF NOT EXISTS activity_log (
  uuid         TEXT PRIMARY KEY,
  user_uuid    TEXT,
  entity_uuid  TEXT,
  action       TEXT NOT NULL CHECK (action IN ('create', 'update', 'delete', 'comment', 'assign', 'status_change')),
  entity_type  TEXT NOT NULL,
  details      TEXT NOT NULL DEFAULT '{}',
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_uuid) REFERENCES users (uuid) ON DELETE SET NULL,
  FOREIGN KEY (entity_uuid) REFERENCES entities (uuid) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_activity_user ON activity_log (user_uuid);
CREATE INDEX IF NOT EXISTS idx_activity_entity ON activity_log (entity_uuid);
CREATE INDEX IF NOT EXISTS idx_activity_action ON activity_log (action);
CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_log (created_at DESC);

-- ============================================================
-- Comments — annotations on any entity
-- ============================================================
CREATE TABLE IF NOT EXISTS comments (
  uuid         TEXT PRIMARY KEY,
  user_uuid    TEXT,
  entity_uuid  TEXT NOT NULL,
  body         TEXT NOT NULL,
  parent_uuid  TEXT,
  resolved     INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_uuid) REFERENCES users (uuid) ON DELETE SET NULL,
  FOREIGN KEY (entity_uuid) REFERENCES entities (uuid) ON DELETE CASCADE,
  FOREIGN KEY (parent_uuid) REFERENCES comments (uuid) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_comments_entity ON comments (entity_uuid);
CREATE INDEX IF NOT EXISTS idx_comments_user ON comments (user_uuid);
CREATE INDEX IF NOT EXISTS idx_comments_parent ON comments (parent_uuid);
