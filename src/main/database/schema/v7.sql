-- Artworks Studio OS — database schema v7
-- Phase 15: Marketplace
--
-- A catalog of plugins, templates, and assets that users can browse,
-- search, and install into their studio. Listings track install state
-- and community ratings.

-- ---------------------------------------------------------------------------
-- Marketplace Listings
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS marketplace_listings (
  uuid              TEXT PRIMARY KEY,
  slug              TEXT NOT NULL UNIQUE,               -- URL-safe identifier
  name              TEXT NOT NULL,
  description       TEXT NOT NULL DEFAULT '',
  author            TEXT NOT NULL DEFAULT '',
  category          TEXT NOT NULL DEFAULT 'utility'
                    CHECK (category IN ('production','ai','integration','workflow','ui','utility','template','asset')),
  type              TEXT NOT NULL DEFAULT 'plugin'
                    CHECK (type IN ('plugin','template','asset')),
  version           TEXT NOT NULL DEFAULT '1.0.0',
  icon              TEXT,                               -- emoji or icon URL
  screenshots       TEXT NOT NULL DEFAULT '[]',         -- JSON array of image URLs
  manifest_id       TEXT,                               -- plugin manifest id (for plugin type)
  download_url      TEXT,                               -- remote download URL
  downloads         INTEGER NOT NULL DEFAULT 0,
  rating            REAL NOT NULL DEFAULT 0,            -- average rating 0-5
  rating_count      INTEGER NOT NULL DEFAULT 0,
  installed         INTEGER NOT NULL DEFAULT 0,         -- 0/1 boolean
  installed_version TEXT,                               -- currently installed version
  listed            INTEGER NOT NULL DEFAULT 1,         -- 0/1 — visible in catalog
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_marketplace_slug ON marketplace_listings (slug);
CREATE INDEX IF NOT EXISTS idx_marketplace_category ON marketplace_listings (category);
CREATE INDEX IF NOT EXISTS idx_marketplace_type ON marketplace_listings (type);
CREATE INDEX IF NOT EXISTS idx_marketplace_installed ON marketplace_listings (installed);
CREATE INDEX IF NOT EXISTS idx_marketplace_listed ON marketplace_listings (listed);
CREATE INDEX IF NOT EXISTS idx_marketplace_downloads ON marketplace_listings (downloads DESC);
CREATE INDEX IF NOT EXISTS idx_marketplace_rating ON marketplace_listings (rating DESC);

-- Full-text search over name, description, author
CREATE VIRTUAL TABLE IF NOT EXISTS marketplace_fts USING fts5(
  uuid, name, description, author,
  content='marketplace_listings',
  content_rowid='rowid'
);

-- Triggers to keep FTS in sync
CREATE TRIGGER IF NOT EXISTS marketplace_ai AFTER INSERT ON marketplace_listings BEGIN
  INSERT INTO marketplace_fts (uuid, name, description, author)
  VALUES (new.uuid, new.name, new.description, new.author);
END;

CREATE TRIGGER IF NOT EXISTS marketplace_ad AFTER DELETE ON marketplace_listings BEGIN
  INSERT INTO marketplace_fts (marketplace_fts, uuid, name, description, author)
  VALUES ('delete', old.uuid, old.name, old.description, old.author);
END;

CREATE TRIGGER IF NOT EXISTS marketplace_au AFTER UPDATE ON marketplace_listings BEGIN
  INSERT INTO marketplace_fts (marketplace_fts, uuid, name, description, author)
  VALUES ('delete', old.uuid, old.name, old.description, old.author);
  INSERT INTO marketplace_fts (uuid, name, description, author)
  VALUES (new.uuid, new.name, new.description, new.author);
END;
