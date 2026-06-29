"""Git synchronization for productions.

``aw git sync`` records the current state of a production as a single
timestamped commit. It initializes a repository if one is not present and
gracefully reports when there is nothing to commit or git is unavailable.
"""

from __future__ import annotations

import subprocess
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path

from aw.services.production import Production


class VcsError(Exception):
    """Raised when a git operation fails in an unrecoverable way."""


@dataclass(frozen=True)
class SyncResult:
    """Outcome of a sync.

    Attributes:
        committed: True if a new commit was created.
        message: The commit message, or a status note if nothing was
            committed.
        initialized: True if a new repository was initialized this run.
    """

    committed: bool
    message: str
    initialized: bool = False


def _run_git(cwd: Path, *args: str) -> subprocess.CompletedProcess[str]:
    """Run a git command and capture its output.

    Args:
        cwd: Working directory for the command.
        *args: Git arguments.

    Returns:
        The completed process.

    Raises:
        VcsError: If git exits non-zero.
    """

    try:
        return subprocess.run(  # noqa: S603 - arguments are controlled
            ["git", *args],
            cwd=str(cwd),
            check=True,
            capture_output=True,
            text=True,
        )
    except FileNotFoundError as err:
        raise VcsError(
            "git was not found. Install git and ensure it is on your PATH."
        ) from err
    except subprocess.CalledProcessError as err:
        stderr = (err.stderr or "").strip()
        raise VcsError(
            f"git {' '.join(args)} failed: {stderr or err.returncode}"
        ) from err


def _ensure_repository(root: Path) -> bool:
    """Initialize a git repo at ``root`` if one is not present.

    Args:
        root: Production root.

    Returns:
        True if a new repository was initialized.
    """

    if (root / ".git").is_dir():
        return False
    _run_git(root, "init")
    return True


def _has_changes(root: Path) -> bool:
    """Return True if there are staged or unstaged changes to commit.

    Args:
        root: Production root.

    Returns:
        True if ``git status --porcelain`` reports any change.
    """

    result = _run_git(root, "status", "--porcelain")
    return bool(result.stdout.strip())


def sync(production: Production) -> SyncResult:
    """Commit the current state of a production.

    Args:
        production: The production to sync.

    Returns:
        A description of the sync outcome.

    Raises:
        VcsError: If git is unavailable or a git command fails.
    """

    root = production.root
    initialized = _ensure_repository(root)

    if not _has_changes(root) and not initialized:
        return SyncResult(committed=False, message="Nothing to commit.")

    _run_git(root, "add", "-A")

    if not initialized and not _has_changes(root):
        # Fresh repo with no working-tree changes: still create the initial
        # commit so history begins here.
        pass

    message = _commit_message(production)
    _run_git(root, "commit", "-m", message)
    return SyncResult(committed=True, message=message, initialized=initialized)


def _commit_message(production: Production) -> str:
    """Build the sync commit message.

    Args:
        production: The production being committed.

    Returns:
        A timestamped commit message.
    """

    timestamp = datetime.now(UTC).strftime("%Y-%m-%d %H:%M:%S UTC")
    return f"sync: {production.name} {timestamp}"
