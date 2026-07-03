-- Production Lifecycle State Machine (v9)
-- Formal lifecycle states with transition rules, guards, and audit trail.

-- ──────────────────────────────────────────────────────────────
-- Production lifecycle — current state per production entity
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS production_lifecycle (
  uuid          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  entity_uuid   TEXT NOT NULL UNIQUE,               -- FK to entities.uuid
  state         TEXT NOT NULL DEFAULT 'draft'
                CHECK (state IN ('draft','active','review','published','archived')),
  entered_at    TEXT NOT NULL DEFAULT (datetime('now')),
  entered_by    TEXT,                               -- user uuid (NULL = system)
  guard_data    TEXT NOT NULL DEFAULT '{}',         -- JSON: conditions that were met
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_production_lifecycle_entity ON production_lifecycle(entity_uuid);
CREATE INDEX IF NOT EXISTS idx_production_lifecycle_state ON production_lifecycle(state);

-- ──────────────────────────────────────────────────────────────
-- Lifecycle transition history — full audit trail
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lifecycle_transitions (
  uuid          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  entity_uuid   TEXT NOT NULL,
  from_state    TEXT NOT NULL,
  to_state      TEXT NOT NULL,
  triggered_by  TEXT,                               -- user uuid (NULL = system)
  reason        TEXT NOT NULL DEFAULT '',
  guard_data    TEXT NOT NULL DEFAULT '{}',         -- JSON: guard check results
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_lifecycle_transitions_entity ON lifecycle_transitions(entity_uuid);
CREATE INDEX IF NOT EXISTS idx_lifecycle_transitions_created ON lifecycle_transitions(created_at);
