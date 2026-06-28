# Changelog

All notable changes to the `aw` CLI (distribution: `artworks-cli`) are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/Dream-Pixels-Forge/artworks-studio-os/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/Dream-Pixels-Forge/artworks-studio-os/releases/tag/v0.1.0
