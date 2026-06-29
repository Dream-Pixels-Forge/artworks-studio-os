"""Doctor command."""

import typer

from aw.config import Settings, get_settings
from aw.constants import VERSION
from aw.services.production import get_active_production, list_productions
from aw.services.studio import is_studio_home
from aw.utils.console import create_console, success_panel


def run_doctor(settings: Settings) -> list[str]:
    """Run environment checks.

    Args:
        settings: Runtime settings.

    Returns:
        Human-readable check results.
    """

    home = settings.home
    lines = [
        f"CLI version: {VERSION}",
        f"Studio home: {home}",
        f"Environment: {settings.environment}",
    ]

    if is_studio_home(home):
        lines.append("Studio workspace: initialized")
        productions = list_productions(home)
        lines.append(f"Productions: {len(productions)}")
        active = get_active_production(home)
        lines.append(f"Active production: {active.name if active else '(none)'}")
    else:
        lines.append("Studio workspace: not initialized (run 'aw studio init')")

    return lines


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
