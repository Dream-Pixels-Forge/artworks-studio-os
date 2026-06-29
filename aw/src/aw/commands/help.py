"""Extended help command."""

import typer

from aw.utils.console import create_console


def register(app: typer.Typer) -> None:
    """Register help command.

    Args:
        app: The root Typer application.
    """

    @app.command("help")
    def help_command() -> None:
        """Show Artworks command guidance."""

        console = create_console()
        console.print("Run [bold]aw --help[/bold] to explore available commands.")
