"""Tests for API endpoints."""

from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

from transcription.models import JobStatus, TranscriptionJob


class TestHealthEndpoint:
    """Tests for health check endpoint."""

    def test_health_check(self, client: TestClient) -> None:
        """Test health check returns ok."""
        with patch("transcription.api.routes.get_arq_redis") as mock_redis:
            mock_redis.return_value = AsyncMock()
            mock_redis.return_value.ping = AsyncMock()

            with patch("torch.cuda.is_available", return_value=False):
                response = client.get("/api/health")

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert "version" in data


class TestTranscribeUrlEndpoint:
    """Tests for URL transcription endpoint."""

    def test_transcribe_url_creates_job(self, client: TestClient) -> None:
        """Test that POST /transcribe/url creates a job."""
        with (
            patch("transcription.api.routes.get_job_storage") as mock_storage,
            patch("transcription.api.routes.get_arq_redis") as mock_arq,
        ):
            mock_storage.return_value = AsyncMock()
            mock_arq.return_value = AsyncMock()
            mock_arq.return_value.enqueue_job = AsyncMock()

            response = client.post(
                "/api/transcribe/url",
                json={
                    "url": "https://youtube.com/watch?v=test123",
                    "language": "en",
                    "enable_diarization": False,
                },
            )

        assert response.status_code == 202
        data = response.json()
        assert "job_id" in data
        assert data["status"] == "pending"

    def test_transcribe_url_invalid_url(self, client: TestClient) -> None:
        """Test that invalid URL returns 422."""
        response = client.post(
            "/api/transcribe/url",
            json={"url": "not-a-valid-url"},
        )

        assert response.status_code == 422


class TestJobStatusEndpoint:
    """Tests for job status endpoint."""

    def test_get_job_status_found(self, client: TestClient, mock_job: TranscriptionJob) -> None:
        """Test getting status of existing job."""
        with patch("transcription.api.routes.get_job_storage") as mock_storage:
            storage = AsyncMock()
            storage.get = AsyncMock(return_value=mock_job)
            mock_storage.return_value = storage

            response = client.get(f"/api/transcribe/{mock_job.id}")

        assert response.status_code == 200
        data = response.json()
        assert data["job_id"] == mock_job.id
        assert data["status"] == "pending"

    def test_get_job_status_not_found(self, client: TestClient) -> None:
        """Test getting status of non-existent job."""
        with patch("transcription.api.routes.get_job_storage") as mock_storage:
            storage = AsyncMock()
            storage.get = AsyncMock(return_value=None)
            mock_storage.return_value = storage

            response = client.get("/api/transcribe/non-existent-id")

        assert response.status_code == 404


class TestJobResultEndpoint:
    """Tests for job result endpoint."""

    def test_get_result_not_completed(
        self, client: TestClient, mock_job: TranscriptionJob
    ) -> None:
        """Test getting result of incomplete job."""
        with patch("transcription.api.routes.get_job_storage") as mock_storage:
            storage = AsyncMock()
            storage.get = AsyncMock(return_value=mock_job)
            mock_storage.return_value = storage

            response = client.get(f"/api/transcribe/{mock_job.id}/result")

        assert response.status_code == 409  # Conflict

    def test_get_result_failed_job(
        self, client: TestClient, mock_job: TranscriptionJob
    ) -> None:
        """Test getting result of failed job."""
        mock_job.status = JobStatus.FAILED
        mock_job.error = "Test error"

        with patch("transcription.api.routes.get_job_storage") as mock_storage:
            storage = AsyncMock()
            storage.get = AsyncMock(return_value=mock_job)
            mock_storage.return_value = storage

            response = client.get(f"/api/transcribe/{mock_job.id}/result")

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "failed"
        assert data["error"] == "Test error"
