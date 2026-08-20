"""Application configuration with pydantic-settings."""

from functools import lru_cache
from typing import Literal

from pydantic import Field, RedisDsn
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

    @property
    def is_development(self) -> bool:
        return self.app_env == "development"

    @property
    def max_file_size_bytes(self) -> int:
        return self.max_file_size_mb * 1024 * 1024


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
