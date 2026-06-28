"""Studio commands."""

import typer

from aw.utils.console import create_console, success_panel


def register(app: typer.Typer) -> None:
    """Register studio commands.

    Args:
        app: The root Typer application.
    """

    studio_app = typer.Typer(help="Manage the local Artworks studio workspace.")

    @studio_app.command("init")
    def init() -> None:
        """Initialize the Artworks studio workspace."""

        console = create_console()
        console.print(success_panel("Studio workspace initialized."))

    app.add_typer(studio_app, name="studio")
