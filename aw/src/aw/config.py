"""Configuration for the Artworks CLI."""

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime settings for the Artworks command layer."""

    model_config = SettingsConfigDict(env_prefix="AW_", extra="ignore")

    home: Path = Path.home() / ".artworks"
    environment: str = "production"


def get_settings() -> Settings:
    """Return CLI settings.

    Returns:
        The loaded settings object.
    """

    return Settings()
