"""Version command."""

import typer

from aw.constants import PRODUCT_NAME, VERSION


def register(app: typer.Typer) -> None:
    """Register the version command.

    Args:
        app: The root Typer application.
    """

    @app.command("version")
    def version() -> None:
        """Show the installed Artworks CLI version."""

        typer.echo(f"{PRODUCT_NAME} CLI {VERSION}")
