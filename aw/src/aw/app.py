"""Typer application factory for the Artworks CLI."""

from collections.abc import Iterable
from importlib import import_module

import typer

from aw.constants import PRODUCT_NAME

COMMAND_MODULES: tuple[str, ...] = (
    "aw.commands.version",
    "aw.commands.doctor",
    "aw.commands.studio",
    "aw.commands.project",
    "aw.commands.docs",
    "aw.commands.git",
    "aw.commands.ai",
    "aw.commands.help",
)


def create_app(command_modules: Iterable[str] = COMMAND_MODULES) -> typer.Typer:
    """Create and configure the CLI application.

    Args:
        command_modules: Import paths for command modules.

    Returns:
        The configured Typer app.
    """

    app = typer.Typer(
        name="aw",
        help=f"{PRODUCT_NAME} command layer.",
        rich_markup_mode="rich",
        no_args_is_help=True,
    )

    for module_name in command_modules:
        module = import_module(module_name)
        module.register(app)

    return app
