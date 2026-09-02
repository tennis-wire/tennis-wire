"""Tests for API endpoints."""

from unittest.mock import AsyncMock

from fastapi.testclient import TestClient

from tests.conftest import FakeJobStorage
from transcription.config import Settings
from transcription.constants import TRANSCRIBE_TASK_NAME
from transcription.models import JobStatus, TranscriptionJob


class TestHealthEndpoint:
    """Tests for health check endpoint."""

    def test_health_check(self, client: TestClient) -> None:
        """Test health check returns ok."""
        response = client.get("/api/health")

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert "version" in data
        assert isinstance(data["gpu_available"], bool)


class TestTranscribeUrlEndpoint:
    """Tests for URL transcription endpoint."""

    def test_transcribe_url_creates_job(
        self,
        client: TestClient,
        job_storage: FakeJobStorage,
        mock_arq: AsyncMock,
    ) -> None:
        """Test that POST /transcribe/url creates and enqueues a job."""
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
        assert data["status"] == "pending"

        job_id = data["job_id"]
        saved = job_storage.jobs.get(job_id)
        assert saved is not None
        assert saved.source_url == "https://youtube.com/watch?v=test123"
        assert saved.language == "en"

        mock_arq.enqueue_job.assert_awaited_once_with(TRANSCRIBE_TASK_NAME, job_id)

    def test_transcribe_url_invalid_url(self, client: TestClient) -> None:
        """Test that invalid URL returns 422."""
        response = client.post(
            "/api/transcribe/url",
            json={"url": "not-a-valid-url"},
        )

        assert response.status_code == 422


class TestJobStatusEndpoint:
    """Tests for job status endpoint."""

    async def test_get_job_status_found(
        self,
        client: TestClient,
        job_storage: FakeJobStorage,
        mock_job: TranscriptionJob,
    ) -> None:
        """Test getting status of existing job."""
        await job_storage.save(mock_job)

        response = client.get(f"/api/transcribe/{mock_job.id}")

        assert response.status_code == 200
        data = response.json()
        assert data["job_id"] == mock_job.id
        assert data["status"] == "pending"

    def test_get_job_status_not_found(self, client: TestClient) -> None:
        """Test getting status of non-existent job."""
        response = client.get("/api/transcribe/non-existent-id")

        assert response.status_code == 404


class TestJobResultEndpoint:
    """Tests for job result endpoint."""

    async def test_get_result_not_completed(
        self,
        client: TestClient,
        job_storage: FakeJobStorage,
        mock_job: TranscriptionJob,
    ) -> None:
        """Test getting result of incomplete job returns 409."""
        await job_storage.save(mock_job)

        response = client.get(f"/api/transcribe/{mock_job.id}/result")

        assert response.status_code == 409

    async def test_get_result_failed_job(
        self,
        client: TestClient,
        job_storage: FakeJobStorage,
        mock_job: TranscriptionJob,
    ) -> None:
        """Test getting result of failed job."""
        mock_job.status = JobStatus.FAILED
        mock_job.error = "Test error"
        await job_storage.save(mock_job)

        response = client.get(f"/api/transcribe/{mock_job.id}/result")

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "failed"
        assert data["error"] == "Test error"

    async def test_get_result_completed(
        self,
        client: TestClient,
        job_storage: FakeJobStorage,
        mock_job: TranscriptionJob,
    ) -> None:
        """Test getting result of completed job returns presigned URL."""
        mock_job.status = JobStatus.COMPLETED
        mock_job.result_file = "results/test-job-123/transcript.json"
        await job_storage.save(mock_job)

        response = client.get(f"/api/transcribe/{mock_job.id}/result")

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "completed"
        assert data["result_url"] == "https://s3.example.com/file"


class TestCancelEndpoint:
    """Tests for job cancellation endpoint."""

    async def test_cancel_pending_job(
        self,
        client: TestClient,
        job_storage: FakeJobStorage,
        mock_job: TranscriptionJob,
    ) -> None:
        """Test cancelling a pending job."""
        await job_storage.save(mock_job)

        response = client.delete(f"/api/transcribe/{mock_job.id}")

        assert response.status_code == 204
        cancelled = job_storage.jobs[mock_job.id]
        assert cancelled.status == JobStatus.FAILED
        assert cancelled.error == "Cancelled by user"

    async def test_cancel_completed_job_conflict(
        self,
        client: TestClient,
        job_storage: FakeJobStorage,
        mock_job: TranscriptionJob,
    ) -> None:
        """Test cancelling a completed job returns 409."""
        mock_job.status = JobStatus.COMPLETED
        await job_storage.save(mock_job)

        response = client.delete(f"/api/transcribe/{mock_job.id}")

        assert response.status_code == 409

    def test_cancel_not_found(self, client: TestClient) -> None:
        """Test cancelling a non-existent job returns 404."""
        response = client.delete("/api/transcribe/non-existent-id")

        assert response.status_code == 404


def test_transcribe_url_rejects_disallowed_host(client: TestClient, mock_arq: AsyncMock) -> None:
    response = client.post("/api/transcribe/url", json={"url": "https://evil.com/video"})

    assert response.status_code == 400
    mock_arq.enqueue_job.assert_not_called()


class TestTranscribeFileEndpoint:
    """Tests for file upload endpoint."""

    def test_upload_creates_job_with_sanitised_key(
        self,
        client: TestClient,
        job_storage: FakeJobStorage,
    ) -> None:
        response = client.post(
            "/api/transcribe/file",
            files={"file": ("../../results/other/transcript.json.mp3", b"data", "audio/mpeg")},
        )

        assert response.status_code == 202
        job_id = response.json()["job_id"]
        assert job_storage.jobs[job_id].source_file == f"uploads/{job_id}/source.mp3"

    def test_upload_rejects_oversized_file(
        self,
        client: TestClient,
        settings: Settings,
        mock_arq: AsyncMock,
    ) -> None:
        settings.max_file_size_mb = 1

        response = client.post(
            "/api/transcribe/file",
            files={"file": ("big.mp3", b"x" * 2 * 1024 * 1024, "audio/mpeg")},
        )

        assert response.status_code == 413
        mock_arq.enqueue_job.assert_not_called()

    def test_upload_rejects_non_media(self, client: TestClient, mock_arq: AsyncMock) -> None:
        response = client.post(
            "/api/transcribe/file",
            files={"file": ("notes.txt", b"data", "text/plain")},
        )

        assert response.status_code == 415
        mock_arq.enqueue_job.assert_not_called()
