-- Enterprise schema (v8)
-- Teams, roles, permissions, audit logging, and license management.

-- ──────────────────────────────────────────────────────────────
-- Teams
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS teams (
  uuid TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  avatar_url TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_teams_slug ON teams(slug);

-- ──────────────────────────────────────────────────────────────
-- Team members (junction: teams ↔ users)
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS team_members (
  uuid TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  team_uuid TEXT NOT NULL REFERENCES teams(uuid) ON DELETE CASCADE,
  user_uuid TEXT NOT NULL REFERENCES users(uuid) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member',          -- owner | admin | member | viewer
  joined_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(team_uuid, user_uuid)
);

CREATE INDEX IF NOT EXISTS idx_team_members_team ON team_members(team_uuid);
CREATE INDEX IF NOT EXISTS idx_team_members_user ON team_members(user_uuid);

-- ──────────────────────────────────────────────────────────────
-- Roles
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS roles (
  uuid TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  name TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  is_system INTEGER NOT NULL DEFAULT 0,         -- 1 = built-in, cannot delete
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ──────────────────────────────────────────────────────────────
-- Permissions
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS permissions (
  uuid TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  name TEXT NOT NULL UNIQUE,                    -- e.g. "project.create", "asset.delete"
  description TEXT NOT NULL DEFAULT '',
  resource TEXT NOT NULL,                       -- project | asset | agent | plugin | settings | team
  action TEXT NOT NULL,                         -- create | read | update | delete | manage
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ──────────────────────────────────────────────────────────────
-- Role ↔ Permission mapping
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS role_permissions (
  uuid TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  role_uuid TEXT NOT NULL REFERENCES roles(uuid) ON DELETE CASCADE,
  permission_uuid TEXT NOT NULL REFERENCES permissions(uuid) ON DELETE CASCADE,
  UNIQUE(role_uuid, permission_uuid)
);

CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role_uuid);

-- ──────────────────────────────────────────────────────────────
-- User ↔ Role assignments (global scope)
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_roles (
  uuid TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_uuid TEXT NOT NULL REFERENCES users(uuid) ON DELETE CASCADE,
  role_uuid TEXT NOT NULL REFERENCES roles(uuid) ON DELETE CASCADE,
  granted_at TEXT NOT NULL DEFAULT (datetime('now')),
  granted_by TEXT REFERENCES users(uuid),
  UNIQUE(user_uuid, role_uuid)
);

CREATE INDEX IF NOT EXISTS idx_user_roles_user ON user_roles(user_uuid);

-- ──────────────────────────────────────────────────────────────
-- Audit log
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_log (
  uuid TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_uuid TEXT REFERENCES users(uuid),        -- NULL = system action
  action TEXT NOT NULL,                         -- e.g. "project.create", "plugin.install"
  resource_type TEXT NOT NULL,                  -- project | asset | agent | plugin | team | settings
  resource_uuid TEXT,                           -- affected entity UUID
  details TEXT NOT NULL DEFAULT '{}',           -- JSON blob with extra info
  ip_address TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log(user_uuid);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_log_resource ON audit_log(resource_type, resource_uuid);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at);

-- ──────────────────────────────────────────────────────────────
-- Licenses
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS licenses (
  uuid TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  key TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL DEFAULT 'pro',             -- free | pro | enterprise
  holder_name TEXT NOT NULL DEFAULT '',
  holder_email TEXT NOT NULL DEFAULT '',
  features TEXT NOT NULL DEFAULT '[]',          -- JSON array of feature flags
  max_users INTEGER NOT NULL DEFAULT 1,
  max_projects INTEGER NOT NULL DEFAULT -1,     -- -1 = unlimited
  expires_at TEXT,                              -- NULL = perpetual
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_licenses_key ON licenses(key);
