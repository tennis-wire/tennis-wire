"""Pytest configuration and fixtures."""

from collections.abc import AsyncIterator
from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi.testclient import TestClient

from transcription.config import Settings
from transcription.main import create_app
from transcription.models import TranscriptionJob


@pytest.fixture
def settings() -> Settings:
    """Test settings."""
    return Settings(
        app_env="development",
        app_debug=True,
        redis_url="redis://localhost:6379/1",  # Use different DB for tests
        s3_endpoint_url="http://localhost:9000",
        s3_access_key="minioadmin",
        s3_secret_key="minioadmin",
        s3_bucket_name="test-transcription",
        whisper_device="cpu",  # Use CPU for tests
        whisper_model="tiny",  # Use tiny model for tests
    )


@pytest.fixture
def app(settings: Settings) -> Any:
    """Create test application."""
    return create_app()


@pytest.fixture
def client(app: Any) -> TestClient:
    """Create test client."""
    return TestClient(app)


@pytest.fixture
def mock_job() -> TranscriptionJob:
    """Create a mock transcription job."""
    return TranscriptionJob(
        id="test-job-123",
        source_url="https://youtube.com/watch?v=test",
        language="en",
    )


@pytest.fixture
def mock_redis() -> AsyncMock:
    """Create mock Redis client."""
    mock = AsyncMock()
    mock.get.return_value = None
    mock.set.return_value = True
    mock.ping.return_value = True
    return mock


@pytest.fixture
def mock_s3() -> MagicMock:
    """Create mock S3 client."""
    mock = MagicMock()
    mock.upload_file = AsyncMock()
    mock.download_file = AsyncMock()
    mock.get_presigned_url = AsyncMock(return_value="https://s3.example.com/file")
    return mock
