# Contributing

Before contributing to `aw`, read the repository root documents:

1. `START-HERE.md`
2. `WHY.md`
3. `CONTEXT.md`
4. `PRINCIPLES.md`
5. `DECISIONS.md`
6. `README.md`

## Development

```bash
uv sync --dev
uv run pytest
uv run ruff check .
uv run black --check .
```

## Standards

- Type hints everywhere.
- Google-style docstrings for public functions.
- Commands live in `src/aw/commands/`.
- Command behavior is tested through the public Typer app.
- Business logic belongs outside the command callback when it grows beyond presentation.
