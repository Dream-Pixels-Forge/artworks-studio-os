"""Console helpers for consistent terminal output."""

from rich.console import Console
from rich.panel import Panel

from aw.constants import PRODUCT_NAME, TAGLINE


def create_console() -> Console:
    """Create the Rich console used by command callbacks.

    Returns:
        A configured Rich console.
    """

    return Console()


def success_panel(message: str) -> Panel:
    """Create a consistent success panel.

    Args:
        message: The message to display.

    Returns:
        A Rich panel for terminal output.
    """

    return Panel.fit(message, title=PRODUCT_NAME, subtitle=TAGLINE, border_style="red")
