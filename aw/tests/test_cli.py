from typer.testing import CliRunner

from aw.app import create_app

runner = CliRunner()


def invoke(*args: str):
    return runner.invoke(create_app(), list(args))


def test_help_shows_command_layer() -> None:
    result = invoke("--help")

    assert result.exit_code == 0
    assert "Artworks Studio OS command layer" in result.output
    assert "version" in result.output
    assert "doctor" in result.output


def test_version_command() -> None:
    result = invoke("version")

    assert result.exit_code == 0
    assert "Artworks Studio OS CLI 0.1.0" in result.output


def test_doctor_command() -> None:
    result = invoke("doctor")

    assert result.exit_code == 0
    assert "CLI command layer: ready" in result.output


def test_studio_init_command() -> None:
    result = invoke("studio", "init")

    assert result.exit_code == 0
    assert "Studio workspace initialized" in result.output


def test_project_new_command_with_name() -> None:
    result = invoke("project", "new", "SIGNAL")

    assert result.exit_code == 0
    assert "Production created: SIGNAL" in result.output


def test_project_open_command() -> None:
    result = invoke("project", "open")

    assert result.exit_code == 0
    assert "Production opened: active" in result.output


def test_docs_bootstrap_command() -> None:
    result = invoke("docs", "bootstrap")

    assert result.exit_code == 0
    assert "Production documentation bootstrapped" in result.output


def test_docs_validate_command() -> None:
    result = invoke("docs", "validate")

    assert result.exit_code == 0
    assert "Production documentation validated" in result.output


def test_git_sync_command() -> None:
    result = invoke("git", "sync")

    assert result.exit_code == 0
    assert "Production history synchronized" in result.output


def test_help_command() -> None:
    result = invoke("help")

    assert result.exit_code == 0
    assert "aw --help" in result.output
