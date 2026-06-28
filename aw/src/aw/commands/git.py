"""Git integration commands."""

import typer

from aw.utils.console import create_console, success_panel


def register(app: typer.Typer) -> None:
    """Register git commands.

    Args:
        app: The root Typer application.
    """

    git_app = typer.Typer(help="Synchronize production history.")

    @git_app.command("sync")
    def sync() -> None:
        """Synchronize production history."""

        console = create_console()
        console.print(success_panel("Production history synchronized."))

    app.add_typer(git_app, name="git")
