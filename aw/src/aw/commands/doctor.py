"""Doctor command."""

from pathlib import Path

import typer

from aw.config import Settings, get_settings
from aw.utils.console import create_console, success_panel


def run_doctor(settings: Settings) -> list[str]:
    """Run environment checks.

    Args:
        settings: Runtime settings.

    Returns:
        Human-readable check results.
    """

    return [
        "CLI command layer: ready",
        f"Studio home: {Path(settings.home)}",
        f"Environment: {settings.environment}",
    ]


def register(app: typer.Typer) -> None:
    """Register the doctor command.

    Args:
        app: The root Typer application.
    """

    @app.command("doctor")
    def doctor() -> None:
        """Check the local Artworks command environment."""

        console = create_console()
        console.print(success_panel("\n".join(run_doctor(get_settings()))))
