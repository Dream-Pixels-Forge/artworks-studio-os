"""Production project commands."""

from typing import Annotated

import typer

from aw.utils.console import create_console, success_panel


def register(app: typer.Typer) -> None:
    """Register project commands.

    Args:
        app: The root Typer application.
    """

    project_app = typer.Typer(help="Manage Artworks productions.")

    @project_app.command("new")
    def new(name: Annotated[str, typer.Argument()] = "UNTITLED") -> None:
        """Create a new production.

        Args:
            name: Production name.
        """

        console = create_console()
        console.print(success_panel(f"Production created: {name}"))

    @project_app.command("open")
    def open_project(name: Annotated[str, typer.Argument()] = "active") -> None:
        """Open a production.

        Args:
            name: Production name or active production marker.
        """

        console = create_console()
        console.print(success_panel(f"Production opened: {name}"))

    app.add_typer(project_app, name="project")
