"""Tests for the Artworks CLI command surface.

Each test runs against a throwaway studio home redirected via AW_HOME so
nothing ever touches the user's real ``~/.artworks``.
"""

from __future__ import annotations

import json

import pytest
from typer.testing import CliRunner

from aw.app import create_app

runner = CliRunner()


@pytest.fixture
def studio_home(tmp_path, monkeypatch):
    """Redirect the studio home to a temp directory and initialize it."""

    home = tmp_path / "studio"
    monkeypatch.setenv("AW_HOME", str(home))
    return home


def invoke(*args: str):
    return runner.invoke(create_app(), list(args))


# --------------------------------------------------------------------------- #
# Baseline commands (unchanged behavior)                                      #
# --------------------------------------------------------------------------- #


def test_help_shows_command_layer() -> None:
    result = invoke("--help")

    assert result.exit_code == 0
    assert "Artworks Studio OS command layer" in result.output
    assert "version" in result.output
    assert "doctor" in result.output


def test_version_command() -> None:
    result = invoke("version")

    assert result.exit_code == 0
    assert "Artworks Studio OS CLI" in result.output


def test_help_command() -> None:
    result = invoke("help")

    assert result.exit_code == 0
    assert "aw --help" in result.output


# --------------------------------------------------------------------------- #
# studio init                                                                  #
# --------------------------------------------------------------------------- #


def test_studio_init_creates_workspace(studio_home) -> None:
    result = invoke("studio", "init")

    assert result.exit_code == 0
    assert "Studio workspace initialized" in result.output
    assert (studio_home / "studio.json").is_file()
    for sub in ("projects", "config", "templates", "assets"):
        assert (studio_home / sub).is_dir(), f"missing {sub}/"


def test_studio_init_is_idempotent(studio_home) -> None:
    invoke("studio", "init")
    result = invoke("studio", "init")

    assert result.exit_code == 0
    assert "already initialized" in result.output


# --------------------------------------------------------------------------- #
# project new / open / list                                                    #
# --------------------------------------------------------------------------- #


def test_project_new_creates_production(studio_home) -> None:
    invoke("studio", "init")
    result = invoke("project", "new", "SIGNAL")

    assert result.exit_code == 0
    assert "Production created: SIGNAL" in result.output

    root = studio_home / "projects" / "SIGNAL"
    for sub in (
        "docs",
        "assets",
        "prompts",
        "storyboards",
        "keyframes",
        "renders",
        "audio",
        "exports",
        "automation",
    ):
        assert (root / sub).is_dir(), f"missing {sub}/"

    manifest_path = root / "project.json"
    assert manifest_path.is_file()
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    assert manifest["name"] == "SIGNAL"
    assert manifest["id"] == "SIGNAL"
    assert manifest["uuid"]
    assert manifest["status"] == "draft"


def test_project_new_default_name(studio_home) -> None:
    invoke("studio", "init")
    result = invoke("project", "new")

    assert result.exit_code == 0
    assert (studio_home / "projects" / "UNTITLED" / "project.json").is_file()


def test_project_new_refuses_overwrite(studio_home) -> None:
    invoke("studio", "init")
    invoke("project", "new", "SIGNAL")
    result = invoke("project", "new", "SIGNAL")

    assert result.exit_code == 1
    assert "already exists" in result.output


def test_project_new_requires_studio(tmp_path, monkeypatch) -> None:
    home = tmp_path / "uninitialized"
    monkeypatch.setenv("AW_HOME", str(home))
    result = invoke("project", "new", "SIGNAL")

    assert result.exit_code == 1
    assert "not initialized" in result.output


def test_project_new_with_path_override(tmp_path, monkeypatch) -> None:
    # No studio home initialized; --path bypasses the studio requirement.
    home = tmp_path / "uninitialized"
    monkeypatch.setenv("AW_HOME", str(home))
    dest = tmp_path / "elsewhere"
    result = invoke("project", "new", "OFFGRID", "--path", str(dest))

    assert result.exit_code == 0
    assert (dest / "OFFGRID" / "project.json").is_file()


def test_project_open_sets_active(studio_home) -> None:
    invoke("studio", "init")
    invoke("project", "new", "ALPHA")
    invoke("project", "new", "BETA")  # BETA becomes active
    result = invoke("project", "open", "ALPHA")

    assert result.exit_code == 0
    assert "Production opened: ALPHA" in result.output
    pointer = (studio_home / "config" / "active-project").read_text(encoding="utf-8")
    assert pointer.strip() == "ALPHA"


def test_project_open_active_default(studio_home) -> None:
    invoke("studio", "init")
    invoke("project", "new", "ALPHA")
    result = invoke("project", "open")

    assert result.exit_code == 0
    assert "Production opened: ALPHA" in result.output


def test_project_list_shows_active_marker(studio_home) -> None:
    invoke("studio", "init")
    invoke("project", "new", "ALPHA")
    invoke("project", "new", "BETA")
    result = invoke("project", "list")

    assert result.exit_code == 0
    assert "ALPHA" in result.output
    assert "BETA" in result.output


# --------------------------------------------------------------------------- #
# docs bootstrap / validate                                                    #
# --------------------------------------------------------------------------- #


EXPECTED_DOC_FILES = (
    "production-bible.md",
    "story-bible.md",
    "character-bible.md",
    "environment-bible.md",
    "prop-bible.md",
    "camera-bible.md",
    "vfx-bible.md",
    "editing-notes.md",
    "storyboard.md",
)


def test_docs_bootstrap_creates_bibles(studio_home) -> None:
    invoke("studio", "init")
    invoke("project", "new", "SIGNAL")
    result = invoke("docs", "bootstrap")

    assert result.exit_code == 0
    assert "bootstrapped" in result.output
    docs = studio_home / "projects" / "SIGNAL" / "docs"
    for name in EXPECTED_DOC_FILES:
        assert (docs / name).is_file(), f"missing {name}"


def test_docs_bootstrap_substitutes_project_name(studio_home) -> None:
    invoke("studio", "init")
    invoke("project", "new", "SIGNAL")
    invoke("docs", "bootstrap")

    text = (
        studio_home / "projects" / "SIGNAL" / "docs" / "production-bible.md"
    ).read_text(encoding="utf-8")
    assert "SIGNAL" in text
    assert "__PROJECT_NAME__" not in text


def test_docs_validate_passes_after_bootstrap(studio_home) -> None:
    invoke("studio", "init")
    invoke("project", "new", "SIGNAL")
    invoke("docs", "bootstrap")
    result = invoke("docs", "validate")

    assert result.exit_code == 0
    assert "validated" in result.output


def test_docs_validate_fails_on_tampered_doc(studio_home) -> None:
    invoke("studio", "init")
    invoke("project", "new", "SIGNAL")
    invoke("docs", "bootstrap")

    # Strip the trailer from one document.
    target = studio_home / "projects" / "SIGNAL" / "docs" / "story-bible.md"
    text = target.read_text(encoding="utf-8").replace("End of Document", "")
    target.write_text(text, encoding="utf-8")

    result = invoke("docs", "validate")
    assert result.exit_code == 1
    assert "issue(s)" in result.output


def test_docs_bootstrap_is_idempotent(studio_home) -> None:
    invoke("studio", "init")
    invoke("project", "new", "SIGNAL")
    invoke("docs", "bootstrap")
    result = invoke("docs", "bootstrap")

    assert result.exit_code == 0
    assert "already present" in result.output


# --------------------------------------------------------------------------- #
# git sync                                                                     #
# --------------------------------------------------------------------------- #


@pytest.fixture
def git_identity(monkeypatch):
    """Provide a throwaway git identity so commits succeed in CI/sandbox."""

    monkeypatch.setenv("GIT_AUTHOR_NAME", "Artworks Test")
    monkeypatch.setenv("GIT_AUTHOR_EMAIL", "test@artworks.local")
    monkeypatch.setenv("GIT_COMMITTER_NAME", "Artworks Test")
    monkeypatch.setenv("GIT_COMMITTER_EMAIL", "test@artworks.local")


def test_git_sync_creates_commit(studio_home, git_identity) -> None:
    invoke("studio", "init")
    invoke("project", "new", "SIGNAL")
    result = invoke("git", "sync")

    assert result.exit_code == 0
    assert "synchronized" in result.output
    assert (studio_home / "projects" / "SIGNAL" / ".git").is_dir()


def test_git_sync_nothing_to_commit(studio_home, git_identity) -> None:
    invoke("studio", "init")
    invoke("project", "new", "SIGNAL")
    invoke("git", "sync")
    result = invoke("git", "sync")

    assert result.exit_code == 0
    assert "Nothing to commit" in result.output


# --------------------------------------------------------------------------- #
# doctor                                                                       #
# --------------------------------------------------------------------------- #


def test_doctor_reports_studio_state(studio_home) -> None:
    invoke("studio", "init")
    invoke("project", "new", "SIGNAL")
    result = invoke("doctor")

    assert result.exit_code == 0
    assert "initialized" in result.output
    assert "Productions: 1" in result.output
    assert "SIGNAL" in result.output


def test_doctor_reports_uninitialized(studio_home) -> None:
    result = invoke("doctor")

    assert result.exit_code == 0
    assert "not initialized" in result.output


# --------------------------------------------------------------------------- #
# services-layer unit tests (no Typer)                                         #
# --------------------------------------------------------------------------- #


def test_template_render_substitutes_placeholders() -> None:
    from aw.utils.templates import render

    assert render("Hello __NAME__!", {"NAME": "World"}) == "Hello World!"
    assert render("No tokens") == "No tokens"


def test_production_manifest_round_trip(studio_home) -> None:
    from aw.services.production import create_production, read_manifest

    invoke("studio", "init")
    production = create_production("ROUNDTRIP", studio_home)
    manifest = read_manifest(production)
    assert manifest["name"] == "ROUNDTRIP"
    assert manifest["schema"] == "artworks/production"


def test_validate_docs_finds_missing_manifest(studio_home) -> None:
    from aw.services.documentation import validate_docs
    from aw.services.production import create_production

    invoke("studio", "init")
    production = create_production("BROKEN", studio_home)
    production.manifest.unlink()  # corrupt it

    issues = validate_docs(production)
    messages = "\n".join(i.message for i in issues)
    assert "missing" in messages.lower()
