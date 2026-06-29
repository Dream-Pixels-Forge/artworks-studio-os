"""Studio workspace initialization.

The studio home is the on-disk root for all of a user's productions. It
defaults to ``~/.artworks`` and can be redirected with ``AW_HOME``.
"""

from dataclasses import dataclass, field
from pathlib import Path

from aw.constants import PRODUCT_NAME, TAGLINE

# Capabilities a fresh studio home must provide. Kept intentionally small:
# the studio is a container for productions, not a production itself.
_STUDIO_DIRECTORIES: tuple[str, ...] = (
    "projects",
    "config",
    "templates",
    "assets",
)

_STUDIO_MARKER = "studio.json"


@dataclass
class StudioResult:
    """Outcome of initializing a studio home.

    Attributes:
        home: The studio home path.
        created_directories: Directories created by this run (empty if the
            studio already existed and was left untouched).
        already_existed: True if the studio home was already initialized.
    """

    home: Path
    created_directories: list[Path] = field(default_factory=list)
    already_existed: bool = False


def is_studio_home(path: Path) -> bool:
    """Return True if ``path`` looks like an initialized studio home.

    Args:
        path: Candidate path.

    Returns:
        True if the studio marker file is present.
    """

    return (path / _STUDIO_MARKER).is_file()


def init_studio(home: Path) -> StudioResult:
    """Initialize the studio home at ``home``.

    Idempotent: if the studio is already initialized, the existing tree is
    left untouched and ``already_existed`` is set on the result.

    Args:
        home: Target studio home path.

    Returns:
        A description of what happened.
    """

    if is_studio_home(home):
        return StudioResult(home=home, already_existed=True)

    home.mkdir(parents=True, exist_ok=True)
    created: list[Path] = []
    for sub in _STUDIO_DIRECTORIES:
        directory = home / sub
        directory.mkdir(parents=True, exist_ok=True)
        created.append(directory)

    marker = home / _STUDIO_MARKER
    marker.write_text(
        _studio_marker_text(),
        encoding="utf-8",
    )

    return StudioResult(home=home, created_directories=created, already_existed=False)


def _studio_marker_text() -> str:
    """Render the studio marker file contents."""

    return (
        "{\n"
        '  "schema": "artworks/studio",\n'
        '  "schema_version": 1,\n'
        f'  "product": "{PRODUCT_NAME}",\n'
        f'  "tagline": "{TAGLINE}"\n'
        "}\n"
    )
