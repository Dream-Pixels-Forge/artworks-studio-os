# Context

Project

Artworks Studio OS

Mission

Build the operating system for AI-native filmmaking.

Current Stage

Production Workspace

Current Priority

AI Workspace

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

Upcoming Work

Phase 14 — Node-Based Production

Phase 15 — Marketplace

Phase 16 — Enterprise

Phase 17 — Production Intelligence

Phase 18 — Production Operating System
