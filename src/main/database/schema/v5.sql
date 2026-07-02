-- Artworks Studio OS — database schema v5
-- Phase 13: AI Production Teams
--
-- Enables specialized AI agents (Creative Director, Character Designer, etc.)
-- with task assignment, conversation, and activity tracking.

-- ---------------------------------------------------------------------------
-- AI Agents
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS ai_agents (
  uuid          TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  role          TEXT NOT NULL,                    -- "creative_director", "character_designer", ...
  system_prompt TEXT NOT NULL DEFAULT '',
  model         TEXT,                             -- provider model identifier
  avatar        TEXT,                             -- avatar URL or emoji
  status        TEXT NOT NULL DEFAULT 'idle'
                CHECK (status IN ('idle','busy','paused','offline')),
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_agents_role ON ai_agents (role);
CREATE INDEX IF NOT EXISTS idx_ai_agents_status ON ai_agents (status);

-- ---------------------------------------------------------------------------
-- Agent Tasks
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS agent_tasks (
  uuid          TEXT PRIMARY KEY,
  agent_id      TEXT NOT NULL,                    -- ai_agents.uuid
  title         TEXT NOT NULL,
  description   TEXT NOT NULL DEFAULT '',
  status        TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending','in_progress','completed','failed','cancelled')),
  priority      TEXT NOT NULL DEFAULT 'medium'
                CHECK (priority IN ('low','medium','high','urgent')),
  input         TEXT NOT NULL DEFAULT '{}',       -- JSON input data for the task
  output        TEXT NOT NULL DEFAULT '{}',       -- JSON output/result data
  due_date      TEXT,
  started_at    TEXT,
  completed_at  TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (agent_id) REFERENCES ai_agents (uuid) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_agent_tasks_agent ON agent_tasks (agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_tasks_status ON agent_tasks (status);
CREATE INDEX IF NOT EXISTS idx_agent_tasks_priority ON agent_tasks (priority);

-- ---------------------------------------------------------------------------
-- Agent Messages (conversation with an agent)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS agent_messages (
  uuid          TEXT PRIMARY KEY,
  agent_id      TEXT NOT NULL,                    -- ai_agents.uuid
  task_id       TEXT,                             -- agent_tasks.uuid (nullable)
  role          TEXT NOT NULL CHECK (role IN ('system','user','assistant')),
  content       TEXT NOT NULL DEFAULT '',
  tokens_used   INTEGER,
  model         TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (agent_id) REFERENCES ai_agents (uuid) ON DELETE CASCADE,
  FOREIGN KEY (task_id) REFERENCES agent_tasks (uuid) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_agent_messages_agent ON agent_messages (agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_messages_task ON agent_messages (task_id);
CREATE INDEX IF NOT EXISTS idx_agent_messages_created ON agent_messages (created_at);
