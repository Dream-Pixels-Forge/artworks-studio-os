-- Node-Graph Execution History (v11)
-- Persists runs of node-workflow graphs and a per-node audit trail.
-- Mirrors the lifecycle state-machine pattern (v9): a current-state row
-- per run plus an append-only step history. Backed by the GraphExecutor
-- in src/main/services/node-execution/.

-- ──────────────────────────────────────────────────────────────
-- node_workflow_runs — one row per "Run" click on a graph
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS node_workflow_runs (
  run_id        TEXT PRIMARY KEY,                        -- "run_<uuidv4>"
  workflow_uuid TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending','running','completed','failed','cancelled','awaiting-review')),
  started_at    TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at  TEXT,
  error         TEXT,
  FOREIGN KEY (workflow_uuid) REFERENCES node_workflows (uuid) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_node_runs_workflow ON node_workflow_runs(workflow_uuid);
CREATE INDEX IF NOT EXISTS idx_node_runs_status ON node_workflow_runs(status);

-- ──────────────────────────────────────────────────────────────
-- node_run_steps — per-node execution audit trail
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS node_run_steps (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id       TEXT NOT NULL,
  node_id      TEXT NOT NULL,                            -- React Flow node id
  node_kind    TEXT NOT NULL,                            -- NodeKind at run time
  status       TEXT NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending','running','completed','failed','skipped')),
  input_json   TEXT,                                     -- gathered upstream outputs
  output_json  TEXT,                                     -- this node's output
  error        TEXT,
  started_at   TEXT,
  completed_at TEXT,
  FOREIGN KEY (run_id) REFERENCES node_workflow_runs (run_id) ON DELETE CASCADE
);

-- One step row per (run, node) — the target of the executor's upsert.
CREATE UNIQUE INDEX IF NOT EXISTS idx_node_steps_run_node ON node_run_steps(run_id, node_id);
CREATE INDEX IF NOT EXISTS idx_node_steps_run ON node_run_steps(run_id);
CREATE INDEX IF NOT EXISTS idx_node_steps_status ON node_run_steps(status);
