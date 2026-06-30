# Changelog

All notable changes to Artworks Studio OS are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Desktop window.** Promoted the application window from "opens a branded
  window" to a production-grade frameless window: a custom, draggable title
  bar with platform-aware window controls (minimize/maximize/restore/close),
  a full application menu bar (File, Edit, View, Window, Help) with keyboard
  accelerators, window-state persistence across restarts, multi-window
  groundwork (a registry with role tagging and a dynamic Window-menu list),
  and graceful shutdown that flushes pending state before quit. Window
  geometry is restored from `config/window-state.json` in the studio home
  and clamped to current displays so a window saved on a now-unplugged
  monitor re-centers on the primary instead of rendering off-screen.
- **Window + menu IPC surfaces.** New `window.artworks.window` and
  `window.artworks.menu` preload APIs drive the title bar and react to app
  menu actions; `window:maximized-changed` pushes keep the title-bar icon in
  sync. Cross-process DTOs live in `src/shared/window/`.

### Changed

- The renderer shell is now a column (title bar above the explorer/main row)
  to host the custom chrome.

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
