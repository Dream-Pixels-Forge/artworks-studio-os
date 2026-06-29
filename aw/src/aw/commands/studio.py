"""Studio workspace commands."""

from typing import Annotated

import typer

from aw.config import get_settings
from aw.services.studio import init_studio
from aw.utils.console import (
    create_console,
    info_panel,
    success_panel,
    warning_panel,
)


def register(app: typer.Typer) -> None:
    """Register studio commands.

    Args:
        app: The root Typer application.
    """

    studio_app = typer.Typer(help="Manage the Artworks studio workspace.")

    @studio_app.command("init")
    def init(
        force: Annotated[
            bool,
            typer.Option("--force", help="Re-initialize even if the studio exists."),
        ] = False,
    ) -> None:
        """Initialize the studio workspace.

        Creates the studio home (default ``~/.artworks``, override with
        ``AW_HOME``) and its capability directories. Idempotent.
        """

        console = create_console()
        settings = get_settings()
        result = init_studio(settings.home)

        if result.already_existed and not force:
            console.print(
                warning_panel(
                    f"Studio already initialized at {result.home}.\n"
                    "Use --force to reinitialize."
                )
            )
            return

        console.print(
            success_panel(
                f"Studio workspace initialized at {result.home}.\n"
                f"Created {len(result.created_directories)} directories."
            )
        )
        console.print(
            info_panel("Next: create a production with 'aw project new <name>'.")
        )

    app.add_typer(studio_app, name="studio")
