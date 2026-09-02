"""Application configuration with pydantic-settings."""

from functools import lru_cache
from typing import Literal

from pydantic import Field, RedisDsn, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # App
    app_env: Literal["development", "staging", "production"] = "development"
    app_debug: bool = False
    log_level: str = "INFO"

    # Server
    host: str = "0.0.0.0"  # noqa: S104 — server bind address, intentional
    port: int = 8001

    # Redis
    redis_url: RedisDsn = Field(default=RedisDsn("redis://localhost:6379/0"))

    # S3 Storage
    s3_endpoint_url: str | None = None
    s3_access_key: str = ""
    s3_secret_key: str = ""
    s3_bucket_name: str = "transcription"
    s3_region: str = "us-east-1"

    # WhisperX
    whisper_model: str = "large-v3"
    whisper_device: Literal["cuda", "cpu"] = "cuda"
    whisper_compute_type: Literal["float16", "float32", "int8"] = "float16"
    hf_token: str | None = None  # For speaker diarization

    # Limits
    max_file_size_mb: int = 500
    max_duration_minutes: int = 180

    @property
    def max_duration_seconds(self) -> int:
        return self.max_duration_minutes * 60

    @property
    def is_development(self) -> bool:
        return self.app_env == "development"

    @property
    def max_file_size_bytes(self) -> int:
        return self.max_file_size_mb * 1024 * 1024

    # Security
    # Subdomains of each entry are allowed too (m.youtube.com, music.youtube.com).
    allowed_media_hosts: list[str] = ["youtube.com", "youtu.be"]

    @field_validator("allowed_media_hosts", mode="before")
    @classmethod
    def _split_hosts(cls, value: object) -> object:
        """Accept a comma-separated string: that is all an env var can carry."""
        if isinstance(value, str):
            return [host.strip().lower() for host in value.split(",") if host.strip()]
        return value


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
