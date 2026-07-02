-- Artworks Studio OS — database schema v2
-- Phase 10: Production Timeline
--
-- Adds the `timelines` table for task management, milestones, and
-- production scheduling. Each timeline item is an entity (generic fields)
-- with timeline-specific columns layered on top.

PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------------------
-- Timeline items (tasks + milestones)
-- ---------------------------------------------------------------------------
-- Every timeline item is an entity with type "timeline". The type table
-- adds scheduling, assignment, and dependency tracking.

CREATE TABLE IF NOT EXISTS timelines (
  uuid         TEXT PRIMARY KEY,
  project_uuid TEXT,
  timeline_type TEXT NOT NULL CHECK (timeline_type IN ('task', 'milestone')),
  start_date   TEXT,
  end_date     TEXT,
  assigned_to  TEXT,
  priority     TEXT NOT NULL DEFAULT 'medium'
               CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  progress     INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  dependencies TEXT NOT NULL DEFAULT '[]',
  FOREIGN KEY (uuid) REFERENCES entities (uuid) ON DELETE CASCADE,
  FOREIGN KEY (project_uuid) REFERENCES projects (uuid) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_timelines_project ON timelines (project_uuid);
CREATE INDEX IF NOT EXISTS idx_timelines_type ON timelines (timeline_type);
CREATE INDEX IF NOT EXISTS idx_timelines_dates ON timelines (start_date, end_date);
