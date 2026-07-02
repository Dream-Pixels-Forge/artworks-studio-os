-- Artworks Studio OS — database schema v6
-- Phase 14: Node-Based Production
--
-- Visual production workflows using a node-based editor.
-- Workflows contain nodes (production, AI, prompt, review, publish)
-- and edges connecting them into programmable pipelines.

-- ---------------------------------------------------------------------------
-- Node Workflows
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS node_workflows (
  uuid          TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  description   TEXT NOT NULL DEFAULT '',
  status        TEXT NOT NULL DEFAULT 'draft'
                CHECK (status IN ('draft','active','archived')),
  nodes         TEXT NOT NULL DEFAULT '[]',          -- JSON array of React Flow nodes
  edges         TEXT NOT NULL DEFAULT '[]',          -- JSON array of React Flow edges
  viewport      TEXT NOT NULL DEFAULT '{"x":0,"y":0,"zoom":1}',  -- JSON viewport state
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_node_workflows_status ON node_workflows (status);
CREATE INDEX IF NOT EXISTS idx_node_workflows_name ON node_workflows (name);
