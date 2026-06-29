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


def _panel(message: str, *, border_style: str) -> Panel:
    """Create a panel with the product title and tagline.

    Args:
        message: The message to display.
        border_style: The Rich border color.

    Returns:
        A Rich panel for terminal output.
    """

    return Panel.fit(
        message, title=PRODUCT_NAME, subtitle=TAGLINE, border_style=border_style
    )


def success_panel(message: str) -> Panel:
    """Create a consistent success panel.

    Args:
        message: The message to display.

    Returns:
        A Rich panel for terminal output.
    """

    return _panel(message, border_style="red")


def warning_panel(message: str) -> Panel:
    """Create a warning panel for recoverable, non-fatal conditions.

    Args:
        message: The message to display.

    Returns:
        A Rich panel for terminal output.
    """

    return _panel(message, border_style="yellow")


def error_panel(message: str) -> Panel:
    """Create an error panel for command failures.

    Args:
        message: The message to display.

    Returns:
        A Rich panel for terminal output.
    """

    return _panel(message, border_style="red")


def info_panel(message: str) -> Panel:
    """Create an informational panel.

    Args:
        message: The message to display.

    Returns:
        A Rich panel for terminal output.
    """

    return _panel(message, border_style="blue")
