"""Configuration with pydantic-settings."""

from datetime import timedelta
from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field, RedisDsn, SecretStr
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

    # Where the worker sends news. Files are for run-once, checking sources without the aggregator
    sink: Literal["aggregator", "files"] = "aggregator"
    aggregator_url: str = "http://localhost:8095"
    aggregator_timeout: timedelta = timedelta(seconds=10)
    # The collector's own token, client_credentials (auth.md 3)
    keycloak_issuer_uri: str = "http://localhost:8180/realms/tennis-wire"
    client_id: str = "parsing-service"
    client_secret: SecretStr = SecretStr("dev-parsing-service-secret")
    # A health snapshot goes on every change, and at least this often: "last run" stays fresh
    health_resend: timedelta = timedelta(minutes=15)

    # Where a site finds who runs the bot; filled before deployment
    bot_contact: str = ""

    connect_timeout: timedelta = timedelta(seconds=10)
    read_timeout: timedelta = timedelta(seconds=30)
    max_response_bytes: int = 10 * 1024 * 1024
    max_redirects: int = 5
    # Pages of one host go one at a time, this far apart
    host_delay: timedelta = timedelta(seconds=1)

    # Longer than an item lives in the aggregator (30 days): an article that stays in a feed past
    # its term, a pinned season calendar, must not come back as new (architecture/aggregator.md 5.1)
    seen_ttl: timedelta = timedelta(days=90)
    robots_ttl: timedelta = timedelta(hours=24)
    pause_min: timedelta = timedelta(minutes=1)
    pause_max: timedelta = timedelta(hours=1)
    # A page that failed for a passing reason is asked again after each of these, then given up
    retry_delays: tuple[timedelta, ...] = (
        timedelta(minutes=5),
        timedelta(minutes=15),
        timedelta(hours=1),
        timedelta(hours=3),
    )

    # When a source counts as unhealthy (architecture/aggregator.md section 4.11)
    health_blocked_after: timedelta = timedelta(hours=1)
    health_failures_in_row: int = 5
    # Share of pages lost among the last ones; judged once there are enough of them
    health_extraction_window: int = 50
    health_extraction_min: int = 20
    health_extraction_lost_share: float = 0.3

    @property
    def user_agent(self) -> str:
        contact = f" (+{self.bot_contact})" if self.bot_contact else ""
        return f"{BOT_NAME}/{__version__}{contact}"

    @property
    def token_url(self) -> str:
        return f"{self.keycloak_issuer_uri.rstrip('/')}/protocol/openid-connect/token"

    @property
    def is_development(self) -> bool:
        return self.app_env == "development"


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
