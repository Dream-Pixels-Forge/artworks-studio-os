# Changelog

All notable changes to the `aw` CLI (distribution: `artworks-cli`) are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.0] - 2026-06-29

### Added

- Real on-disk behavior for every command (commands were stubs in 0.1.0).
- Service layer under `aw/services/` for filesystem, documentation, and
  version-control logic, decoupled from the Typer command surface.
- Bundled documentation templates under `aw/templates/` (project manifest
  and the production-bible set), packaged with the wheel and rendered via
  `importlib.resources`.
- `aw studio init` now creates the studio home with its capability
  directories and a `studio.json` marker. Idempotent with `--force`.
- `aw project new <name>` scaffolds the canonical production tree
  (docs/assets/prompts/storyboards/keyframes/renders/audio/exports/automation)
  and writes a human-readable `project.json` manifest. New `--path` flag
  creates a production outside the studio home. Sets the new production as
  active.
- `aw project open <name>` resolves and activates a production; with no
  argument, opens the active production.
- `aw project list` lists all productions, marking the active one.
- `aw docs bootstrap` populates a production's `docs/` with the full
  production-bible set (Production, Story, Character, Environment, Prop,
  Camera, VFX, Editing Notes, Storyboard), each with the house metadata
  header and `End of Document` trailer. Idempotent.
- `aw docs validate` checks the project manifest and every Markdown
  document for required metadata and trailer; exits non-zero on findings.
- `aw git sync` initializes a git repository if needed, stages all
  production files, and creates a timestamped commit.
- `aw doctor` now reports real studio state: whether the studio is
  initialized, production count, and the active production.
- Console helpers `error_panel`, `warning_panel`, and `info_panel` for
  consistent non-success output.
- `project list` command and the `--project` flag on `docs`/`git` commands
  to operate on a non-active production.
- Expanded test suite (25 tests) asserting real on-disk behavior via a
  hermetic `AW_HOME`-redirected studio home.

### Changed

- Command callbacks now delegate to `aw.services.*` instead of printing
  placeholders.

## [0.1.0] - 2026-06-27

### Added

- First public release of the Artworks Studio OS command layer.
- Initial command set:
  - `aw --help` — command discovery.
  - `aw version` — installed CLI version.
  - `aw doctor` — environment and configuration health check.
  - `aw studio init` — initialize the local studio home.
  - `aw project new <name>` — create a new production project.
  - `aw project open` — open an existing production project.
  - `aw docs bootstrap` — scaffold project documentation.
  - `aw docs validate` — validate documentation structure.
  - `aw git sync` — sync project state with its repository.
- Modular command registration via `register(app)` plugin pattern.
- Rich-powered console output with consistent branding.
- Full type hints and Google-style docstrings.
- Test coverage for every command (`tests/test_cli.py`).
- Ruff + Black configuration for consistent style.

[Unreleased]: https://github.com/Dream-Pixels-Forge/artworks-studio-os/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/Dream-Pixels-Forge/artworks-studio-os/releases/tag/v0.2.0
[0.1.0]: https://github.com/Dream-Pixels-Forge/artworks-studio-os/releases/tag/v0.1.0
