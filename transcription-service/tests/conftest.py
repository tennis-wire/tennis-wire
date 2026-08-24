"""Pytest configuration and fixtures."""

from collections.abc import Iterator
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from transcription.api.routes import get_arq_redis, get_job_storage, get_s3_storage
from transcription.main import create_app
from transcription.models import TranscriptionJob


class FakeJobStorage:
    """In-memory JobStorage replacement for tests."""

    def __init__(self) -> None:
        self.jobs: dict[str, TranscriptionJob] = {}

    async def save(self, job: TranscriptionJob) -> None:
        self.jobs[job.id] = job

    async def get(self, job_id: str) -> TranscriptionJob | None:
        return self.jobs.get(job_id)

    async def delete(self, job_id: str) -> None:
        self.jobs.pop(job_id, None)


@pytest.fixture
def job_storage() -> FakeJobStorage:
    """In-memory job storage."""
    return FakeJobStorage()


@pytest.fixture
def mock_arq() -> AsyncMock:
    """Mock ARQ Redis connection."""
    mock = AsyncMock()
    mock.enqueue_job = AsyncMock()
    mock.ping = AsyncMock()
    return mock


@pytest.fixture
def mock_s3() -> MagicMock:
    """Mock S3 storage."""
    mock = MagicMock()
    mock.upload_file = AsyncMock(return_value="uploads/key")
    mock.download_file = AsyncMock()
    mock.get_presigned_url = AsyncMock(return_value="https://s3.example.com/file")
    return mock


@pytest.fixture
def app(
    job_storage: FakeJobStorage,
    mock_arq: AsyncMock,
    mock_s3: MagicMock,
) -> Iterator[FastAPI]:
    """Test application with all external dependencies overridden."""
    application = create_app()
    application.dependency_overrides[get_job_storage] = lambda: job_storage
    application.dependency_overrides[get_arq_redis] = lambda: mock_arq
    application.dependency_overrides[get_s3_storage] = lambda: mock_s3
    yield application
    application.dependency_overrides.clear()


@pytest.fixture
def client(app: FastAPI) -> TestClient:
    """Test client."""
    return TestClient(app)


@pytest.fixture
def mock_job() -> TranscriptionJob:
    """A sample transcription job."""
    return TranscriptionJob(
        id="test-job-123",
        source_url="https://youtube.com/watch?v=test",
        language="en",
    )
