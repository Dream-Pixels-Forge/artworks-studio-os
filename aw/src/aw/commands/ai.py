"""AI department commands placeholder."""

import typer


def register(app: typer.Typer) -> None:
    """Register AI commands.

    Args:
        app: The root Typer application.
    """

    ai_app = typer.Typer(help="Coordinate AI departments.")
    app.add_typer(ai_app, name="ai")
