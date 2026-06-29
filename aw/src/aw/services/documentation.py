"""Production documentation bootstrap and validation.

The documentation set mirrors the production bibles described in prd.md
and roadmap.md (Story Development). Each generated file follows the repo
house style: a metadata header block and an ``End of Document`` trailer.
"""

from __future__ import annotations

from dataclasses import dataclass
from importlib.resources import files
from pathlib import Path

from aw.services.production import Production

# Template name -> output file name. Templates live under
# aw/templates/documentation/.
DOCUMENTATION_TEMPLATES: dict[str, str] = {
    "production-bible.md": "production-bible.md",
    "story-bible.md": "story-bible.md",
    "character-bible.md": "character-bible.md",
    "environment-bible.md": "environment-bible.md",
    "prop-bible.md": "prop-bible.md",
    "camera-bible.md": "camera-bible.md",
    "vfx-bible.md": "vfx-bible.md",
    "editing-notes.md": "editing-notes.md",
    "storyboard.md": "storyboard.md",
}

# Required manifest fields for docs validation (mirrors project.json template).
REQUIRED_MANIFEST_FIELDS: tuple[str, ...] = ("uuid", "id", "name", "status")

_METADATA_KEYS: tuple[str, ...] = ("Version:", "Status:", "Audience:")
_DOCUMENT_TRAILER = "End of Document"


@dataclass(frozen=True)
class DocIssue:
    """A single validation finding.

    Attributes:
        path: The file the finding applies to.
        message: Human-readable description.
    """

    path: Path
    message: str


@dataclass
class BootstrapResult:
    """Outcome of bootstrapping documentation.

    Attributes:
        written: Files written by this run.
        skipped: Files that already existed and were left untouched.
    """

    written: list[Path]
    skipped: list[Path]


def bootstrap_docs(production: Production) -> BootstrapResult:
    """Populate a production's ``docs/`` directory with the bible set.

    Idempotent: existing files are never overwritten. New files are written
    with the project name substituted into the title.

    Args:
        production: The production to bootstrap.

    Returns:
        A description of what was written and skipped.

    Raises:
        FileNotFoundError: If a bundled template is missing.
    """

    docs_dir = production.root / "docs"
    docs_dir.mkdir(parents=True, exist_ok=True)

    written: list[Path] = []
    skipped: list[Path] = []

    for template_name, output_name in DOCUMENTATION_TEMPLATES.items():
        target = docs_dir / output_name
        if target.exists():
            skipped.append(target)
            continue

        body = (
            files("aw.templates")
            .joinpath("documentation", template_name)
            .read_text(encoding="utf-8")
        )
        body = body.replace("__PROJECT_NAME__", production.name)
        target.write_text(body, encoding="utf-8")
        written.append(target)

    return BootstrapResult(written=written, skipped=skipped)


def validate_docs(production: Production) -> list[DocIssue]:
    """Validate a production's documentation set.

    Checks, per the repo's "Definition of Done" and repository rules:

    * The project manifest exists and is well-formed JSON with the required
      fields.
    * Each Markdown document carries a metadata header (Version/Status/
      Audience) and an ``End of Document`` trailer.

    Args:
        production: The production to validate.

    Returns:
        Findings in stable order. An empty list means everything passed.
    """

    import json

    issues: list[DocIssue] = []

    manifest = production.manifest
    if not manifest.is_file():
        issues.append(DocIssue(manifest, "project.json is missing."))
    else:
        try:
            data = json.loads(manifest.read_text(encoding="utf-8"))
        except json.JSONDecodeError as err:
            issues.append(DocIssue(manifest, f"project.json is not valid JSON: {err}"))
            data = None
        if isinstance(data, dict):
            for field in REQUIRED_MANIFEST_FIELDS:
                if field not in data:
                    issues.append(
                        DocIssue(
                            manifest,
                            f"project.json is missing required field '{field}'.",
                        )
                    )

    docs_dir = production.root / "docs"
    if not docs_dir.is_dir():
        issues.append(DocIssue(docs_dir, "docs/ directory is missing."))
        return issues

    markdown_files = sorted(p for p in docs_dir.rglob("*.md"))
    if not markdown_files:
        issues.append(DocIssue(docs_dir, "docs/ contains no Markdown documents."))

    for md in markdown_files:
        text = md.read_text(encoding="utf-8")
        for key in _METADATA_KEYS:
            if key not in text:
                issues.append(DocIssue(md, f"missing metadata key '{key}'."))
        if _DOCUMENT_TRAILER not in text:
            issues.append(DocIssue(md, f"missing '{_DOCUMENT_TRAILER}' trailer."))

    return issues
