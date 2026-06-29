"""Production project commands."""

from typing import Annotated

import typer

from aw.config import get_settings
from aw.services.production import (
    ProductionExistsError,
    ProductionNotFoundError,
    StudioNotInitializedError,
    create_production,
    find_production,
    get_active_production,
)
from aw.utils.console import (
    create_console,
    error_panel,
    info_panel,
    success_panel,
    warning_panel,
)


def register(app: typer.Typer) -> None:
    """Register project commands.

    Args:
        app: The root Typer application.
    """

    project_app = typer.Typer(help="Manage Artworks productions.")

    @project_app.command("new")
    def new(
        name: Annotated[str, typer.Argument()] = "UNTITLED",
        path: Annotated[
            str | None,
            typer.Option(
                "--path",
                help="Create the production here instead of the studio home.",
            ),
        ] = None,
    ) -> None:
        """Create a new production.

        Args:
            name: Production name.
            path: Optional destination directory override.
        """

        console = create_console()
        settings = get_settings()

        try:
            production = create_production(
                name,
                settings.home,
                path=path if path else None,
            )
        except StudioNotInitializedError as err:
            console.print(error_panel(str(err)))
            raise typer.Exit(1) from err
        except ProductionExistsError as err:
            console.print(error_panel(str(err)))
            raise typer.Exit(1) from err

        console.print(
            success_panel(
                f"Production created: {production.name}\n"
                f"Location: {production.root}\n"
                "Set as active production."
            )
        )
        console.print(info_panel("Next: add production docs with 'aw docs bootstrap'."))

    @project_app.command("open")
    def open_project(
        name: Annotated[str, typer.Argument()] = "active",
    ) -> None:
        """Open a production by name, or the active one if omitted.

        Args:
            name: Production name, or ``active`` to use the active production.
        """

        console = create_console()
        settings = get_settings()

        if name == "active":
            production = get_active_production(settings.home)
            if production is None:
                console.print(
                    error_panel(
                        "No active production. Open one with 'aw project open <name>'."
                    )
                )
                raise typer.Exit(1)
        else:
            try:
                production = find_production(name, settings.home)
            except StudioNotInitializedError as err:
                console.print(error_panel(str(err)))
                raise typer.Exit(1) from err
            except ProductionNotFoundError as err:
                console.print(error_panel(str(err)))
                raise typer.Exit(1) from err

        from aw.services.production import set_active_production

        set_active_production(settings.home, production)
        console.print(
            success_panel(
                f"Production opened: {production.name}\nLocation: {production.root}"
            )
        )

    @project_app.command("list")
    def list_projects() -> None:
        """List all productions in the studio."""

        console = create_console()
        settings = get_settings()

        from aw.services.production import list_productions

        productions = list_productions(settings.home)
        active = get_active_production(settings.home)

        if not productions:
            console.print(warning_panel("No productions found in the studio."))
            return

        lines: list[str] = []
        for production in productions:
            marker = "*" if active and active.name == production.name else " "
            lines.append(f"{marker} {production.name}")
        console.print(success_panel("\n".join(lines)))

    app.add_typer(project_app, name="project")
