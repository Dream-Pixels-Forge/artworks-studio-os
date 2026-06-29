-- Artworks Studio OS — database schema v1
--
-- Implements the design in docs/database.md. The schema is deliberately
-- normalized: a single generic "entity" structure carries the fields every
-- object has, with type-specific tables layered on top via shared PKs.
--
-- Design rules honored (database.md "Design Rules"):
--   * The database owns truth (metadata, search, relationships).
--   * Markdown owns documentation. Git owns history. The file system owns binaries.
--   * The knowledge graph owns relationships. AI owns reasoning.

PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------------------
-- Schema versioning
-- ---------------------------------------------------------------------------
-- The migrator records the highest applied migration here. Read on startup
-- to decide which migrations are pending.

CREATE TABLE IF NOT EXISTS _schema_version (
  version    INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ---------------------------------------------------------------------------
-- Entities (generic structure — database.md "Entity Structure")
-- ---------------------------------------------------------------------------
-- Every persisted object is an entity first. Type-specific tables reference
-- entities by uuid and add their own columns. This gives us uniform search,
-- tagging, and versioning across all object types.

CREATE TABLE IF NOT EXISTS entities (
  uuid        TEXT PRIMARY KEY,
  id          TEXT NOT NULL,                 -- human-readable, e.g. "CHR-001"
  name        TEXT NOT NULL,
  type        TEXT NOT NULL,                 -- "character", "scene", "asset", ...
  status      TEXT NOT NULL DEFAULT 'draft'
              CHECK (status IN ('draft','active','review','approved','final','archived')),
  version     INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
  owner       TEXT,
  tags        TEXT NOT NULL DEFAULT '[]',    -- JSON array
  metadata    TEXT NOT NULL DEFAULT '{}'     -- JSON object
);

-- Human-readable IDs are unique within a type (CHR-001 is unique among chars).
CREATE UNIQUE INDEX IF NOT EXISTS idx_entities_id_type ON entities (id, type);
CREATE INDEX IF NOT EXISTS idx_entities_type ON entities (type);
CREATE INDEX IF NOT EXISTS idx_entities_status ON entities (status);
CREATE INDEX IF NOT EXISTS idx_entities_name ON entities (name);

-- ---------------------------------------------------------------------------
-- Relationships (knowledge graph edges — database.md "Knowledge Graph")
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS relationships (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  source_uuid TEXT NOT NULL,
  target_uuid TEXT NOT NULL,
  type        TEXT NOT NULL,                 -- "appears_in", "owns", "references", ...
  properties  TEXT NOT NULL DEFAULT '{}',    -- JSON object
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (source_uuid) REFERENCES entities (uuid) ON DELETE CASCADE,
  FOREIGN KEY (target_uuid) REFERENCES entities (uuid) ON DELETE CASCADE,
  UNIQUE (source_uuid, target_uuid, type)
);

CREATE INDEX IF NOT EXISTS idx_relationships_source ON relationships (source_uuid);
CREATE INDEX IF NOT EXISTS idx_relationships_target ON relationships (target_uuid);

-- ---------------------------------------------------------------------------
-- Version history (database.md "Version history")
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS version_history (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_uuid TEXT NOT NULL,
  version     INTEGER NOT NULL,
  snapshot    TEXT NOT NULL,                 -- JSON of the entity at this version
  changed_by  TEXT,
  changed_at  TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (entity_uuid) REFERENCES entities (uuid) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_version_history_entity ON version_history (entity_uuid, version);

-- ---------------------------------------------------------------------------
-- Type-specific tables
-- ---------------------------------------------------------------------------
-- Each references entities by uuid (shared PK). Columns mirror the per-type
-- tables in database.md. Binary data is NEVER stored here — only references
-- to files on disk.

CREATE TABLE IF NOT EXISTS projects (
  uuid        TEXT PRIMARY KEY,
  description TEXT NOT NULL DEFAULT '',
  FOREIGN KEY (uuid) REFERENCES entities (uuid) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS assets (
  uuid        TEXT PRIMARY KEY,
  asset_type  TEXT NOT NULL CHECK (asset_type IN ('image','video','audio','document')),
  path        TEXT NOT NULL,                 -- relative to project root
  mime_type   TEXT NOT NULL,
  size_bytes  INTEGER,
  FOREIGN KEY (uuid) REFERENCES entities (uuid) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_assets_type ON assets (asset_type);

CREATE TABLE IF NOT EXISTS documents (
  uuid        TEXT PRIMARY KEY,
  project_uuid TEXT,
  doc_type    TEXT NOT NULL,                 -- "production-bible", "story-bible", ...
  content     TEXT NOT NULL DEFAULT '',      -- markdown source
  FOREIGN KEY (uuid) REFERENCES entities (uuid) ON DELETE CASCADE,
  FOREIGN KEY (project_uuid) REFERENCES projects (uuid) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_documents_project ON documents (project_uuid);

CREATE TABLE IF NOT EXISTS prompts (
  uuid        TEXT PRIMARY KEY,
  project_uuid TEXT,
  provider    TEXT,                          -- "openai", "anthropic", "ollama"
  model       TEXT,
  template    TEXT NOT NULL DEFAULT '',
  FOREIGN KEY (uuid) REFERENCES entities (uuid) ON DELETE CASCADE,
  FOREIGN KEY (project_uuid) REFERENCES projects (uuid) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS images (
  uuid        TEXT PRIMARY KEY,
  width       INTEGER,
  height      INTEGER,
  source_prompt_uuid TEXT,
  FOREIGN KEY (uuid) REFERENCES assets (uuid) ON DELETE CASCADE,
  FOREIGN KEY (source_prompt_uuid) REFERENCES prompts (uuid) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS videos (
  uuid        TEXT PRIMARY KEY,
  duration_seconds REAL,
  fps         REAL,
  source_prompt_uuid TEXT,
  FOREIGN KEY (uuid) REFERENCES assets (uuid) ON DELETE CASCADE,
  FOREIGN KEY (source_prompt_uuid) REFERENCES prompts (uuid) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS conversations (
  uuid        TEXT PRIMARY KEY,
  project_uuid TEXT,
  provider    TEXT,
  model       TEXT,
  messages    TEXT NOT NULL DEFAULT '[]',    -- JSON array of message objects
  FOREIGN KEY (uuid) REFERENCES entities (uuid) ON DELETE CASCADE,
  FOREIGN KEY (project_uuid) REFERENCES projects (uuid) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS workflows (
  uuid        TEXT PRIMARY KEY,
  project_uuid TEXT,
  definition  TEXT NOT NULL DEFAULT '{}',    -- JSON pipeline definition
  state       TEXT NOT NULL DEFAULT 'idle'
              CHECK (state IN ('idle','running','paused','completed','failed')),
  FOREIGN KEY (uuid) REFERENCES entities (uuid) ON DELETE CASCADE,
  FOREIGN KEY (project_uuid) REFERENCES projects (uuid) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS plugins (
  uuid        TEXT PRIMARY KEY,
  manifest    TEXT NOT NULL DEFAULT '{}',    -- JSON plugin manifest
  enabled     INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (uuid) REFERENCES entities (uuid) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS settings (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ---------------------------------------------------------------------------
-- Full-text search (database.md "Search")
-- ---------------------------------------------------------------------------
-- FTS5 virtual table mirroring entity name + metadata for universal search.
-- Kept in sync by triggers so search never drifts from the source of truth.

CREATE VIRTUAL TABLE IF NOT EXISTS entities_fts USING fts5(
  uuid UNINDEXED,
  name,
  type,
  metadata,
  content='entities',
  content_rowid='rowid'
);

-- Triggers keep the FTS index in sync with entities.
CREATE TRIGGER IF NOT EXISTS entities_ai AFTER INSERT ON entities BEGIN
  INSERT INTO entities_fts (uuid, name, type, metadata)
  VALUES (new.uuid, new.name, new.type, new.metadata);
END;

CREATE TRIGGER IF NOT EXISTS entities_ad AFTER DELETE ON entities BEGIN
  DELETE FROM entities_fts WHERE uuid = old.uuid;
END;

CREATE TRIGGER IF NOT EXISTS entities_au AFTER UPDATE ON entities BEGIN
  DELETE FROM entities_fts WHERE uuid = old.uuid;
  INSERT INTO entities_fts (uuid, name, type, metadata)
  VALUES (new.uuid, new.name, new.type, new.metadata);
END;
