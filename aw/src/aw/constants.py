"""Shared constants for the Artworks CLI.

The version is single-sourced from the installed distribution metadata
(``artworks-cli``) so it can never drift from ``pyproject.toml``.
"""

from importlib.metadata import PackageNotFoundError, version

APP_NAME = "aw"
PRODUCT_NAME = "Artworks Studio OS"
TAGLINE = "Create Stories. Build Worlds. Direct Intelligence."

try:
    # The distribution name is ``artworks-cli``; the import name stays ``aw``.
    VERSION = version("artworks-cli")
except PackageNotFoundError:  # pragma: no cover - running from raw source
    VERSION = "0.0.0+unknown"
