"""Documentation commands."""

from typing import Annotated

import typer

from aw.config import get_settings
from aw.services.documentation import bootstrap_docs, validate_docs
from aw.services.production import (
    ProductionNotFoundError,
    StudioNotInitializedError,
    get_active_production,
    read_manifest,
)
from aw.utils.console import (
    create_console,
    error_panel,
    info_panel,
    success_panel,
    warning_panel,
)


def _resolve_active_production(console, settings) -> object | None:
    """Resolve the active production or exit with an error.

    Returns the production, or None and raises typer.Exit on failure.
    """

    production = get_active_production(settings.home)
    if production is None:
        console.print(
            error_panel(
                "No active production. Create one with 'aw project new <name>'."
            )
        )
        raise typer.Exit(1)
    return production


def register(app: typer.Typer) -> None:
    """Register documentation commands.

    Args:
        app: The root Typer application.
    """

    docs_app = typer.Typer(help="Bootstrap and validate production documentation.")

    @docs_app.command("bootstrap")
    def bootstrap(
        project: Annotated[
            str | None,
            typer.Option("--project", help="Production name (defaults to active)."),
        ] = None,
    ) -> None:
        """Bootstrap production documentation."""

        console = create_console()
        settings = get_settings()

        from aw.services.production import find_production

        try:
            if project is None:
                production = _resolve_active_production(console, settings)
            else:
                production = find_production(project, settings.home)
        except StudioNotInitializedError as err:
            console.print(error_panel(str(err)))
            raise typer.Exit(1) from err
        except ProductionNotFoundError as err:
            console.print(error_panel(str(err)))
            raise typer.Exit(1) from err

        result = bootstrap_docs(production)
        if not result.written:
            console.print(
                warning_panel(
                    f"All docs already present in {production.root / 'docs'}."
                    f"\nSkipped {len(result.skipped)} files."
                )
            )
            return

        console.print(
            success_panel(
                f"Production documentation bootstrapped for {production.name}.\n"
                f"Wrote {len(result.written)} files to {production.root / 'docs'}."
                + (
                    f"\nSkipped {len(result.skipped)} existing files."
                    if result.skipped
                    else ""
                )
            )
        )
        console.print(info_panel("Next: validate with 'aw docs validate'."))

    @docs_app.command("validate")
    def validate(
        project: Annotated[
            str | None,
            typer.Option("--project", help="Production name (defaults to active)."),
        ] = None,
    ) -> None:
        """Validate production documentation."""

        console = create_console()
        settings = get_settings()

        from aw.services.production import find_production

        try:
            if project is None:
                production = _resolve_active_production(console, settings)
            else:
                production = find_production(project, settings.home)
        except StudioNotInitializedError as err:
            console.print(error_panel(str(err)))
            raise typer.Exit(1) from err
        except ProductionNotFoundError as err:
            console.print(error_panel(str(err)))
            raise typer.Exit(1) from err

        issues = validate_docs(production)
        if not issues:
            try:
                manifest = read_manifest(production)
                name = manifest.get("name", production.name)
            except Exception:  # noqa: BLE001 - best-effort display
                name = production.name
            console.print(
                success_panel(
                    f"Production documentation validated: {name}\n" "All checks passed."
                )
            )
            return

        lines = [f"{production.name}: {len(issues)} issue(s) found:", ""]
        for issue in issues:
            lines.append(f"- {issue.path.name}: {issue.message}")
        console.print(error_panel("\n".join(lines)))
        raise typer.Exit(1)

    app.add_typer(docs_app, name="docs")
