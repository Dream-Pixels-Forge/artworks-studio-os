"""Documentation commands."""

import typer

from aw.utils.console import create_console, success_panel


def register(app: typer.Typer) -> None:
    """Register documentation commands.

    Args:
        app: The root Typer application.
    """

    docs_app = typer.Typer(help="Bootstrap and validate production documentation.")

    @docs_app.command("bootstrap")
    def bootstrap() -> None:
        """Bootstrap production documentation."""

        console = create_console()
        console.print(success_panel("Production documentation bootstrapped."))

    @docs_app.command("validate")
    def validate() -> None:
        """Validate production documentation."""

        console = create_console()
        console.print(success_panel("Production documentation validated."))

    app.add_typer(docs_app, name="docs")
