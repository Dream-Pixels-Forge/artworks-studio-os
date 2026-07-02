-- Phase 12: Studio Platform
-- Departments, approvals, and reviews for studio workflows.

PRAGMA foreign_keys = ON;

-- ============================================================================
-- DEPARTMENTS
-- Organizational units within a studio (Art, VFX, Editorial, etc.).
-- ============================================================================
CREATE TABLE IF NOT EXISTS departments (
  uuid TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  lead_uuid TEXT REFERENCES users(uuid) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_departments_name ON departments(name);
CREATE INDEX IF NOT EXISTS idx_departments_lead_uuid ON departments(lead_uuid);

-- ============================================================================
-- DEPARTMENT_MEMBERS
-- Many-to-many: which users belong to which departments.
-- ============================================================================
CREATE TABLE IF NOT EXISTS department_members (
  uuid TEXT PRIMARY KEY,
  department_uuid TEXT NOT NULL REFERENCES departments(uuid) ON DELETE CASCADE,
  user_uuid TEXT NOT NULL REFERENCES users(uuid) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('lead', 'member')),
  joined_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(department_uuid, user_uuid)
);

CREATE INDEX IF NOT EXISTS idx_department_members_department_uuid ON department_members(department_uuid);
CREATE INDEX IF NOT EXISTS idx_department_members_user_uuid ON department_members(user_uuid);

-- ============================================================================
-- APPROVALS
-- Asset/entity approval workflow. A requester submits, an approver decides.
-- ============================================================================
CREATE TABLE IF NOT EXISTS approvals (
  uuid TEXT PRIMARY KEY,
  entity_uuid TEXT NOT NULL REFERENCES entities(uuid) ON DELETE CASCADE,
  requester_uuid TEXT NOT NULL REFERENCES users(uuid) ON DELETE CASCADE,
  approver_uuid TEXT NOT NULL REFERENCES users(uuid) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_approvals_entity_uuid ON approvals(entity_uuid);
CREATE INDEX IF NOT EXISTS idx_approvals_requester_uuid ON approvals(requester_uuid);
CREATE INDEX IF NOT EXISTS idx_approvals_approver_uuid ON approvals(approver_uuid);
CREATE INDEX IF NOT EXISTS idx_approvals_status ON approvals(status);

-- ============================================================================
-- REVIEWS
-- Structured review pipeline. Reviewers assess entities with feedback.
-- ============================================================================
CREATE TABLE IF NOT EXISTS reviews (
  uuid TEXT PRIMARY KEY,
  entity_uuid TEXT NOT NULL REFERENCES entities(uuid) ON DELETE CASCADE,
  reviewer_uuid TEXT NOT NULL REFERENCES users(uuid) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
  rating INTEGER CHECK (rating IS NULL OR (rating >= 1 AND rating <= 5)),
  feedback TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_reviews_entity_uuid ON reviews(entity_uuid);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewer_uuid ON reviews(reviewer_uuid);
CREATE INDEX IF NOT EXISTS idx_reviews_status ON reviews(status);
