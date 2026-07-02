# Changelog

All notable changes to Artworks Studio OS are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Workspace/Docking System (Phase 1).** A panel registry and dockable
  layout system: panels register into a registry, the layout renders them
  into named slots (left sidebar with icon rail, center with tabs, optional
  right sidebar, optional bottom panel). Layout state persists to
  localStorage and reconciles against the registry on load. The static
  studio shell is replaced by `WorkspaceLayout`.

- **Production Workspace (Phase 2).** Production IPC bridge exposing
  project, asset, document, search, and dashboard-stats CRUD to the
  renderer. Five new panels: Dashboard (production stats), Project Manager
  (create/list/delete database projects), Asset Browser (filter by type),
  Markdown Editor (split-pane editor with live preview), and Search
  (FTS5 full-text search).

- **Knowledge Graph (Phase 3).** Graph IPC (connect, relationships,
  disconnect), version history repository (record, list, get snapshot),
  entity metadata operations (tag, untag, patchStatus, get, listByType).
  Two new panels: Knowledge Graph (entity list + relationship viewer +
  link creator) and Version History (entity version browser + snapshot
  detail).

- **AI Workspace (Phase 4).** Conversation repository with message
  append. AI Chat panel with conversation list, message thread, and
  input bar. Preload bridge extended with `conversation` API.

- **Story Development (Phase 5).** Story Bible panel — a specialized
  markdown editor for production bibles (story, character, environment,
  prop, production). Creates and edits documents with story-specific
  doc types.

- **Prompt Intelligence (Phase 6).** Prompt repository with template
  rendering (`{{variable}}` substitution). Prompt Composer panel with
  provider/model targeting, variable input, and live render preview.

- **Asset Pipeline (Phase 7).** Asset Browser panel already covers
  image/video/audio browsing. The IPC layer supports full asset CRUD
  with type filtering and path/mime tracking.

- **Production Automation (Phase 8).** Workflow repository with step
  definitions and state tracking (idle/running/paused/completed/failed).
  Workflow Builder panel: create workflows, add/remove/reorder steps,
  save definitions, and trigger execution state changes.

- **Codebase cleanup.** Gitignored `imagen/`, `videgen/`, `audgen/`
  folders. Fixed stale README/plugins README/logger comments. Fixed DB
  close ordering bug (close after plugin teardown, not in
  window-all-closed). Moved `better-sqlite3` to runtime dependencies.
  Added dev-only guard for `.ts` plugin entry resolution.

### Fixed

- **Document list query (NULL vs empty string).** `listByProject("")`
  missed all documents with `project_uuid = NULL`. Added `listAll()`;
  IPC `production:document:list` now accepts optional `projectUuid`
  (omit → list all).

- **WorkflowRepository transaction safety.** `updateState` and
  `updateDefinition` now run inside a single transaction with a null
  guard instead of a bare `!` assertion.

- **ConversationRepository.addMessage read-inside-transaction.** The
  entity read moved inside the transaction to prevent stale reads.

- **FTS5 query escaping.** User input wrapped in double-phrase syntax
  (`"..."` with `""` escapes) to prevent FTS5 syntax errors.

- **Dashboard entity count.** Replaced broken `listByType("entity")`
  with `countAll()` for the total entity count.

- **Knowledge Graph type coverage.** Added `conversation`, `prompt`,
  and `workflow` to the entity-type list so all entity classes appear.

- **IPC input validation.** Asset path traversal blocked (`..`),
  project name required, workflow state validated against enum.

- **IPC error logging.** Create handlers for conversation, prompt, and
  workflow now log errors before re-throwing.

### Changed

- Studio shell now renders `WorkspaceLayout` instead of a static
  explorer + main split.
- `config.isDev` is now true during tests (`NODE_ENV=test`) so source
  plugins load correctly in the test suite.
- `listensTo` manifest field documented as declarative metadata.
- Plugin runtime README updated to reflect implemented state.

## [0.1.0] - 2026-06-29 — Phase 0 (Foundation)

### Added

- **Command layer (`aw` CLI).** The Python command line for studio
  workspace, production, documentation, and version-control operations.
  Real on-disk behavior, 25 tests. See `aw/CHANGELOG.md`.
- **Platform scaffold.** Electron + React + TypeScript application via
  electron-vite, with main / preload / renderer process boundaries mapped
  to the capability modules in `docs/structure.md`.
- **CI/CD.** GitHub Actions workflows for both the CLI (`aw/`) and the
  platform (`src/`): lint, typecheck/format, build, and test on Ubuntu and
  Windows.
- **Core infrastructure.** Command bus, service container (dependency
  injection), typed event bus, runtime configuration, and a structured
  logger under `src/main/core/`.
- **Design system.** `docs/design-system.md` formalizes the visual
  language; tokens ship as TypeScript constants and CSS custom properties
  (`src/renderer/ui/tokens/`) with Studio Dark and Studio Light themes.
- **Database schema.** `src/main/database/schema/v1.sql` implements every
  table in `docs/database.md` — generic entity structure, relationships,
  version history, and full-text search — plus an idempotent, versioned
  migration runner.
- **Plugin SDK contract.** Typed interfaces for every service in
  `docs/plugin-sdk.md` (`src/shared/sdk/`), the manifest + permissions
  model, a reference plugin (`plugins/example-hello/`), and
  `docs/sdk-reference.md`.
- **Secure preload bridge.** A typed `window.artworks` API exposed to the
  renderer via contextBridge, with context isolation and sandboxing on.

### Documentation

- `docs/design-system.md`, `docs/sdk-reference.md` added.
- `docs/structure.md` extended with a Platform Mapping section reconciling
  capability modules with Electron process boundaries.

[Unreleased]: https://github.com/Dream-Pixels-Forge/artworks-studio-os/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/Dream-Pixels-Forge/artworks-studio-os/releases/tag/v0.1.0