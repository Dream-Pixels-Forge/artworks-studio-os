# Architecture Overview

`aw` is organized around a small application factory and command modules.

## Layers

- `aw.main`: Console entry point.
- `aw.app`: Builds the Typer application and loads command modules.
- `aw.commands`: Registers CLI commands.
- `aw.services`: Future home for production, docs, git, and AI service logic.
- `aw.plugins`: Future plugin command discovery and registration.
- `aw.models`: Future typed data contracts.
- `aw.utils`: Shared presentation and filesystem helpers.

## Command Registration

Commands are not implemented directly in `main.py`.

Each command module exposes a `register(app: typer.Typer) -> None` function. The application factory imports those modules and lets each module attach its command group or callback.

This keeps the CLI open for future plugin registration while preserving a stable single executable: `aw`.

## Future Compatibility

The first version does not implement the Desktop bridge, REST API, AI agents, GitHub integration, or production knowledge engine. It reserves clean package boundaries for those systems so they can be added without rewriting the command layer.
