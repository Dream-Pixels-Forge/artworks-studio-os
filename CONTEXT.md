# Context

Project

Artworks Studio OS

Mission

Build the operating system for AI-native filmmaking.

Current Stage

Production Operating System

Current Priority

Phase 18 — Production Lifecycle & System Integration

Current Architecture

Production Engine

Knowledge Graph

Context Engine

Git

Documentation

AI Departments

Asset Pipeline

Workflow Engine

Plugin Runtime

Timeline Engine

Studio Platform

Node-Based Production

Marketplace

Enterprise (RBAC)

Production Intelligence

Current Design Principles

Story First

Production Before Generation

Single Source of Truth

AI is the Crew

Current Decisions

Prompts are generated automatically.

Providers are implementation details.

Everything belongs to a production.

Relationships are more valuable than files.

Never expose unnecessary AI complexity.

Important Documents

START-HERE.md

WHY.md

README.md

docs/philosophy.md

docs/vision.md

docs/prd.md

Phase Status

Phase 0 (Foundation) — complete.

Phase 1 (Desktop Foundation) — complete.

Workspace/docking system with panel registry, layout slots, persisted state.

Phase 2 (Production Workspace) — complete.

Production IPC, Project Manager, Asset Browser, Markdown Editor, Search, Dashboard.

Phase 3 (Knowledge Graph) — complete.

Graph IPC, version history repository, Knowledge Graph panel, Version History panel.

Phase 4 (AI Workspace) — complete.

Conversation repository, AI Chat panel.

Phase 5 (Story Development) — complete.

Story Bible panel with specialized doc types.

Phase 6 (Prompt Intelligence) — complete.

Prompt repository, Prompt Composer panel with template rendering.

Phase 7 (Asset Pipeline) — complete.

Asset Browser with type filtering and CRUD.

Phase 8 (Production Automation) — complete.

Workflow repository, Workflow Builder panel with step editor.

Phase 3–8 Hardening — complete.

Bug fixes across Phases 3-8: document list NULL-vs-empty-string query,
transaction safety in WorkflowRepository and ConversationRepository,
FTS5 query escaping, Knowledge Graph type coverage, dashboard entity
count, IPC input validation, and error logging.

Phase 9 (Plugin Platform) — complete.

Plugin repository with DB-backed install/uninstall, PluginRuntime
with lifecycle management, SDK services (Project, Asset, Graph, Event,
Notification, AI, File, Media, Prompt), IPC handlers for plugin CRUD,
preload bridge, Plugin Manager panel with detail view and file picker,
command palette bridging for plugin commands, and runtime enable/disable
wiring through DB.

Phase 10 (Production Timeline) — complete.

Timeline repository with CRUD, date-range queries, dependency tracking,
progress analytics, and stats. Timeline IPC handlers, preload bridge,
Timeline Panel with inline editing, progress bars, priority badges, and
filtering. Command palette commands for task/milestone creation and
stats viewing.

Phase 11 (Collaboration) — complete.

User, Activity, and Comment repositories with CRUD and queries. IPC
handlers, preload bridge, Collaboration panel with team management,
activity feed, and comments. Command palette commands for user
management and activity viewing. Schema migration v3 with users,
activity_log, and comments tables.

Phase 12 (Studio Platform) — complete.

Department, Approval, and Review repositories with CRUD and queries.
IPC handlers, preload bridge, Studio Panel with department management,
approval workflow, review pipeline, and analytics overview. Command
palette commands for department creation, studio stats, and panel
opening. Schema migration v4 with departments, department_members,
approvals, and reviews tables.

Phase 13 (AI Production Teams) — complete.

Agent, AgentTask, and AgentMessage repositories with CRUD, status
management, and stats. 25+ IPC handlers for agent lifecycle, task
workflow, and message tracking. Preload bridge with agent, agentTask,
agentMessage APIs. Agent Teams panel with overview, agent management,
task management, and message history. Command palette commands for
agent creation, listing, and stats. Schema migration v5 with ai_agents,
agent_tasks, and agent_messages tables.

Phase 14 (Node-Based Production) — complete.

NodeWorkflowRepository with CRUD and graph operations. 8 IPC handlers
for workflow lifecycle and graph management. Preload bridge with
nodeWorkflow API. Node Production Panel with React Flow canvas-based
node editor, 17-item node palette (5 categories), drag-and-drop,
custom ProductionNode with category-based color coding, right-click
context menu with edit/delete, double-click edge label editing, node
property panel sidebar with live preview, keyboard shortcuts (Delete/
Backspace, Escape), auto-save with 2s debounce, Background/Controls/
MiniMap. Command palette commands for workflow creation, listing, stats,
and panel opening. Schema migration v6 with node_workflows table and
JSON nodes/edges/viewport storage.

Phase 15 (Marketplace) — complete.

Schema, repository, IPC handlers, Marketplace panel with listing
browsing, install/uninstall, search, and detail views. Command palette
commands for marketplace search and panel opening. Schema migration v7
with marketplace_listings, marketplace_installations, and
marketplace_reviews tables.

Phase 16 (Enterprise) — complete.

Team, Role, Permission, and AuditLog repositories with RBAC. Enterprise
panel with team management, role assignment, permission matrix, and
audit log viewer. Schema migration v8 with teams, roles, permissions,
team_members, team_roles, role_permissions, and audit_log tables.

Phase 17 (Production Intelligence) — complete.

ProductionIntelligenceRepository with 8 cross-repo analytics queries:
productionHealth, activityMetrics, timelineAnalytics, entityAnalytics,
aiUsageMetrics, teamProductivity, productionSummary. 7 IPC handlers.
Production Intelligence Panel with 4-tab dashboard (Overview, Timeline,
Team, AI). Command palette commands for panel opening and stats.

Upcoming Work

Phase 18 — Production Operating System

Final integration phase that unifies all subsystems into a cohesive OS experience.

Scope:
- Production Lifecycle State Machine — formal states (draft → active → review → published → archived) with transition rules and guards
- Notification Center — centralized notification management, real-time alerts, unread tracking, cross-panel event bus
- Backup & Recovery — database backup/restore, production export/import, crash recovery
- System Health Dashboard — database integrity checks, performance metrics, storage usage
- User Preferences — cross-session settings, API key management, theme selection, keyboard shortcuts
