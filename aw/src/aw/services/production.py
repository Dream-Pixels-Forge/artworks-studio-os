"""Production project lifecycle: creation, resolution, and activation.

A production is a directory tree on disk rooted at ``<studio>/projects/<name>``
(architecture.md "File Structure") plus a human-readable ``project.json``
manifest (database.md ``projects``/entity tables).
"""

from __future__ import annotations

import json
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path

from aw.utils.templates import render_template

# Canonical per-project capability directories (architecture.md "File Structure").
PRODUCTION_DIRECTORIES: tuple[str, ...] = (
    "docs",
    "assets",
    "prompts",
    "storyboards",
    "keyframes",
    "renders",
    "audio",
    "exports",
    "automation",
)

PROJECT_MANIFEST = "project.json"
_ACTIVE_PROJECT_FILE = "active-project"

_DEFAULT_STATUS = "draft"


class ProductionError(Exception):
    """Raised when a production operation cannot complete."""


class ProductionNotFoundError(ProductionError):
    """Raised when a referenced production does not exist."""

    def __init__(self, name: str, path: Path) -> None:
        super().__init__(f"Production not found: {name} (looked in {path})")
        self.name = name
        self.path = path


class ProductionExistsError(ProductionError):
    """Raised when creating a production that already exists."""

    def __init__(self, path: Path) -> None:
        super().__init__(f"A production already exists at {path}")
        self.path = path


class StudioNotInitializedError(ProductionError):
    """Raised when the studio home has not been initialized."""

    def __init__(self, home: Path) -> None:
        super().__init__(
            f"Studio home not initialized at {home}. Run 'aw studio init' first."
        )
        self.home = home


@dataclass(frozen=True)
class Production:
    """A resolved production project on disk.

    Attributes:
        name: Production name (directory name).
        root: Absolute path to the production root.
        manifest: Path to the project.json manifest.
    """

    name: str
    root: Path
    manifest: Path


def _now_iso() -> str:
    """Return the current UTC time as an ISO 8601 string."""

    return datetime.now(UTC).isoformat(timespec="seconds")


def _projects_root(studio_home: Path) -> Path:
    """Return the studio's projects directory."""

    return studio_home / "projects"


def _require_studio(studio_home: Path) -> None:
    """Ensure the studio home is initialized.

    Args:
        studio_home: Candidate studio home.

    Raises:
        StudioNotInitializedError: If the studio marker is absent.
    """

    from aw.services.studio import is_studio_home

    if not is_studio_home(studio_home):
        raise StudioNotInitializedError(studio_home)


def _slugify(name: str) -> str:
    """Normalize a production name into a filesystem-safe slug.

    Args:
        name: Raw production name.

    Returns:
        A slug with spaces collapsed and unsafe characters replaced.
    """

    slug = name.strip()
    if not slug:
        raise ProductionError("Production name cannot be empty.")
    return slug


def _write_manifest(path: Path, *, name: str) -> dict[str, object]:
    """Render and write the project manifest.

    Args:
        path: Destination manifest path.
        name: Production display name.

    Returns:
        The parsed manifest as a dictionary.
    """

    manifest_text = render_template(
        "project",
        PROJECT_MANIFEST,
        {
            "UUID": str(uuid.uuid4()),
            "ID": _human_id(name),
            "NAME": name,
            "STATUS": _DEFAULT_STATUS,
            "CREATED_AT": _now_iso(),
            "DESCRIPTION": "",
        },
    )
    path.write_text(manifest_text, encoding="utf-8")
    return json.loads(manifest_text)


def _human_id(name: str) -> str:
    """Derive a short human-readable ID from a production name.

    Args:
        name: Production name.

    Returns:
        An uppercase token derived from the name.
    """

    token = "".join(ch for ch in name.upper() if ch.isalnum())
    return token or "UNTITLED"


def create_production(
    name: str,
    studio_home: Path,
    *,
    path: Path | None = None,
) -> Production:
    """Create a new production on disk.

    Args:
        name: Production name.
        studio_home: The studio home (must be initialized unless ``path``
            is given).
        path: Optional explicit destination directory. When given, the
            production is created at ``path/<name>`` and the studio home is
            not required to exist.

    Returns:
        The created production.

    Raises:
        ProductionExistsError: If the target directory already holds a
            production manifest.
        StudioNotInitializedError: If ``path`` is None and the studio is
            not initialized.
    """

    slug = _slugify(name)
    base = Path(path) if path is not None else _projects_root(studio_home)
    if path is None:
        _require_studio(studio_home)

    root = base / slug
    manifest = root / PROJECT_MANIFEST

    if manifest.exists():
        raise ProductionExistsError(root)

    for sub in PRODUCTION_DIRECTORIES:
        (root / sub).mkdir(parents=True, exist_ok=True)

    _write_manifest(manifest, name=name)

    production = Production(name=slug, root=root, manifest=manifest)
    if path is None:
        set_active_production(studio_home, production)
    return production


def find_production(name: str, studio_home: Path) -> Production:
    """Resolve a production by name within the studio home.

    Args:
        name: Production name (directory name).
        studio_home: The studio home.

    Returns:
        The resolved production.

    Raises:
        StudioNotInitializedError: If the studio is not initialized.
        ProductionNotFoundError: If no such production exists.
    """

    _require_studio(studio_home)
    root = _projects_root(studio_home) / _slugify(name)
    manifest = root / PROJECT_MANIFEST
    if not manifest.is_file():
        raise ProductionNotFoundError(name, root)
    return Production(name=name, root=root, manifest=manifest)


def get_active_production(studio_home: Path) -> Production | None:
    """Return the currently active production, if any.

    Args:
        studio_home: The studio home.

    Returns:
        The active production, or None if none is set or it no longer
        exists on disk.
    """

    from aw.services.studio import is_studio_home

    if not is_studio_home(studio_home):
        return None

    pointer = _active_project_path(studio_home)
    if not pointer.is_file():
        return None

    name = pointer.read_text(encoding="utf-8").strip()
    if not name:
        return None

    try:
        return find_production(name, studio_home)
    except ProductionNotFoundError:
        return None


def set_active_production(studio_home: Path, production: Production) -> None:
    """Record ``production`` as the active production.

    Args:
        studio_home: The studio home.
        production: The production to mark active.
    """

    pointer = _active_project_path(studio_home)
    pointer.parent.mkdir(parents=True, exist_ok=True)
    pointer.write_text(production.name, encoding="utf-8")


def _active_project_path(studio_home: Path) -> Path:
    """Return the path to the active-project pointer file."""

    return studio_home / "config" / _ACTIVE_PROJECT_FILE


def read_manifest(production: Production) -> dict[str, object]:
    """Read and parse a production's manifest.

    Args:
        production: The production to read.

    Returns:
        The manifest as a dictionary.

    Raises:
        ProductionError: If the manifest is missing or not valid JSON.
    """

    if not production.manifest.is_file():
        raise ProductionError(f"Manifest missing at {production.manifest}")
    try:
        return json.loads(production.manifest.read_text(encoding="utf-8"))
    except json.JSONDecodeError as err:
        raise ProductionError(
            f"Invalid manifest JSON at {production.manifest}: {err}"
        ) from err


def list_productions(studio_home: Path) -> list[Production]:
    """List all productions in the studio home.

    Args:
        studio_home: The studio home.

    Returns:
        Productions sorted by name. Empty if the studio is uninitialized.
    """

    from aw.services.studio import is_studio_home

    if not is_studio_home(studio_home):
        return []

    root = _projects_root(studio_home)
    if not root.is_dir():
        return []

    productions = [
        Production(name=p.name, root=p, manifest=p / PROJECT_MANIFEST)
        for p in sorted(root.iterdir())
        if p.is_dir() and (p / PROJECT_MANIFEST).is_file()
    ]
    return productions
