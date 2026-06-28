# aw

`aw` is the command layer for Artworks Studio OS.

It is designed as a single executable with modular command registration so the Desktop app, AI agents, automation, plugins, and future services can speak through one production-centered interface.

## Install

### For users

```bash
# Recommended: install as an isolated CLI tool
uv tool install artworks-cli
aw --help

# Or with pipx
pipx install artworks-cli
```

The package is published on PyPI as **`artworks-cli`** and provides the `aw` command.

### For contributors

```bash
uv sync --dev
uv run aw --help
```

## Initial Commands

```bash
aw --help
aw version
aw doctor
aw studio init
aw project new SIGNAL
aw project open
aw docs bootstrap
aw docs validate
aw git sync
```

## Philosophy

Build a platform, not a utility.

The CLI exists to reduce production friction for filmmakers while keeping Artworks Studio OS production-centric, modular, and ready for plugin expansion.
