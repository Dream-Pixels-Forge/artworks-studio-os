"""Git integration commands."""

from typing import Annotated

import typer

from aw.config import get_settings
from aw.services.production import (
    ProductionNotFoundError,
    StudioNotInitializedError,
    find_production,
    get_active_production,
)
from aw.services.vcs import VcsError, sync
from aw.utils.console import (
    create_console,
    error_panel,
    success_panel,
    warning_panel,
)


def register(app: typer.Typer) -> None:
    """Register git commands.

    Args:
        app: The root Typer application.
    """

    git_app = typer.Typer(help="Synchronize production history.")

    @git_app.command("sync")
    def sync_command(
        project: Annotated[
            str | None,
            typer.Option("--project", help="Production name (defaults to active)."),
        ] = None,
    ) -> None:
        """Commit the current state of a production."""

        console = create_console()
        settings = get_settings()

        try:
            if project is None:
                production = get_active_production(settings.home)
                if production is None:
                    console.print(
                        error_panel(
                            "No active production. "
                            "Create one with 'aw project new <name>'."
                        )
                    )
                    raise typer.Exit(1)
            else:
                production = find_production(project, settings.home)
        except StudioNotInitializedError as err:
            console.print(error_panel(str(err)))
            raise typer.Exit(1) from err
        except ProductionNotFoundError as err:
            console.print(error_panel(str(err)))
            raise typer.Exit(1) from err

        try:
            result = sync(production)
        except VcsError as err:
            console.print(error_panel(str(err)))
            raise typer.Exit(1) from err

        if result.committed:
            note = (
                f"Initialized repository and committed.\n{result.message}"
                if result.initialized
                else result.message
            )
            console.print(success_panel(f"Production history synchronized.\n{note}"))
        else:
            console.print(warning_panel(f"Nothing to commit for {production.name}."))

    app.add_typer(git_app, name="git")
