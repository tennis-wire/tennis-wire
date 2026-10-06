"""Configuration with pydantic-settings."""

from datetime import timedelta
from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field, RedisDsn
from pydantic_settings import BaseSettings, SettingsConfigDict

from parsing import __version__

# Product token of the User-Agent; robots.txt groups are matched against it
BOT_NAME = "TennisWireBot"


class Settings(BaseSettings):
    """Settings loaded from environment variables and .env."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_env: Literal["development", "staging", "production"] = "development"
    log_level: str = "INFO"

    # Database 1: the transcription worker uses 0 of the same Redis
    redis_url: RedisDsn = Field(default=RedisDsn("redis://localhost:6379/1"))

    sources_file: Path = Path("sources.yaml")
    output_dir: Path = Path("out")

    # Where a site finds who runs the bot; filled before deployment
    bot_contact: str = ""

    connect_timeout: timedelta = timedelta(seconds=10)
    read_timeout: timedelta = timedelta(seconds=30)
    max_response_bytes: int = 10 * 1024 * 1024
    max_redirects: int = 5
    # Pages of one host go one at a time, this far apart
    host_delay: timedelta = timedelta(seconds=1)

    seen_ttl: timedelta = timedelta(days=30)
    robots_ttl: timedelta = timedelta(hours=24)
    pause_min: timedelta = timedelta(minutes=1)
    pause_max: timedelta = timedelta(hours=1)

    @property
    def user_agent(self) -> str:
        contact = f" (+{self.bot_contact})" if self.bot_contact else ""
        return f"{BOT_NAME}/{__version__}{contact}"

    @property
    def is_development(self) -> bool:
        return self.app_env == "development"


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
