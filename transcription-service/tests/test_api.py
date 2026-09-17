"""Tests for API endpoints."""

from datetime import UTC, datetime
from unittest.mock import AsyncMock

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from jwt import PyJWK, PyJWKClientConnectionError

from tests.conftest import AUTHOR_SUB, FakeJobStorage, TokenFactory
from transcription.api.deps import get_token_verifier
from transcription.auth import TokenVerifier
from transcription.config import Settings
from transcription.constants import TRANSCRIBE_TASK_NAME
from transcription.models import JobStatus, TranscriptionJob


class TestHealthEndpoint:
    """Tests for health check endpoint."""

    def test_health_check(self, anonymous_client: TestClient) -> None:
        """Test health check returns ok."""
        response = anonymous_client.get("/api/health")

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

    def test_transcribe_url_rejects_disallowed_host(
        self, client: TestClient, mock_arq: AsyncMock
    ) -> None:
        response = client.post("/api/transcribe/url", json={"url": "https://evil.com/video"})

        assert response.status_code == 400
        mock_arq.enqueue_job.assert_not_called()


AUTHOR_ROUTES = (
    ("get", "/api/transcribe/jobs"),
    ("post", "/api/transcribe/url"),
    ("post", "/api/transcribe/file"),
    ("get", "/api/transcribe/test-job-123"),
    ("get", "/api/transcribe/test-job-123/result"),
    ("delete", "/api/transcribe/test-job-123"),
)


class TestAuthentication:
    """The author gate on every transcription route."""

    @pytest.mark.parametrize(("method", "path"), AUTHOR_ROUTES)
    def test_no_token_is_401(
        self, anonymous_client: TestClient, mock_arq: AsyncMock, method: str, path: str
    ) -> None:
        response = anonymous_client.request(method, path)

        assert response.status_code == 401
        assert response.headers["WWW-Authenticate"] == "Bearer"
        mock_arq.enqueue_job.assert_not_called()

    def test_invalid_token_is_401(self, anonymous_client: TestClient) -> None:
        response = anonymous_client.get(
            "/api/transcribe/test-job-123", headers={"Authorization": "Bearer not.a.jwt"}
        )

        assert response.status_code == 401
        assert 'error="invalid_token"' in response.headers["WWW-Authenticate"]

    def test_reader_is_403(
        self, anonymous_client: TestClient, make_token: TokenFactory, mock_arq: AsyncMock
    ) -> None:
        token = make_token(realm_access={"roles": ["user"]})

        response = anonymous_client.post(
            "/api/transcribe/url",
            json={"url": "https://youtube.com/watch?v=test123"},
            headers={"Authorization": f"Bearer {token}"},
        )

        assert response.status_code == 403
        mock_arq.enqueue_job.assert_not_called()

    def test_admin_passes_through_the_composite(
        self, anonymous_client: TestClient, make_token: TokenFactory
    ) -> None:
        # Keycloak expands composites into the token, so admin arrives carrying author.
        token = make_token(realm_access={"roles": ["admin", "user", "author", "moderator"]})

        response = anonymous_client.post(
            "/api/transcribe/url",
            json={"url": "https://youtube.com/watch?v=test123"},
            headers={"Authorization": f"Bearer {token}"},
        )

        assert response.status_code == 202

    def test_unreachable_keys_are_503(
        self,
        app: FastAPI,
        anonymous_client: TestClient,
        settings: Settings,
        make_token: TokenFactory,
    ) -> None:
        class Unreachable:
            def get_signing_key_from_jwt(self, token: str) -> PyJWK:
                raise PyJWKClientConnectionError("connection refused")

        verifier = TokenVerifier(Unreachable(), settings.keycloak_issuer_uri, settings.jwt_audience)
        app.dependency_overrides[get_token_verifier] = lambda: verifier

        response = anonymous_client.get(
            "/api/transcribe/test-job-123", headers={"Authorization": f"Bearer {make_token()}"}
        )

        assert response.status_code == 503

    def test_health_stays_anonymous(self, anonymous_client: TestClient) -> None:
        assert anonymous_client.get("/api/health").status_code == 200


class TestOwnership:
    """A job belongs to the author who started it."""

    def test_new_job_records_its_owner(
        self, client: TestClient, job_storage: FakeJobStorage
    ) -> None:
        response = client.post(
            "/api/transcribe/url", json={"url": "https://youtube.com/watch?v=test123"}
        )

        saved = job_storage.jobs[response.json()["job_id"]]
        assert saved.owner_sub == AUTHOR_SUB
        assert saved.owner_username == "dev"

    @pytest.mark.parametrize(
        ("method", "path"),
        [
            ("get", "/api/transcribe/test-job-123"),
            ("get", "/api/transcribe/test-job-123/result"),
            ("delete", "/api/transcribe/test-job-123"),
        ],
    )
    async def test_another_authors_job_is_not_found(
        self,
        anonymous_client: TestClient,
        make_token: TokenFactory,
        job_storage: FakeJobStorage,
        mock_job: TranscriptionJob,
        method: str,
        path: str,
    ) -> None:
        await job_storage.save(mock_job)
        token = make_token(sub="someone-else", preferred_username="colleague")

        response = anonymous_client.request(
            method, path, headers={"Authorization": f"Bearer {token}"}
        )

        assert response.status_code == 404
        assert job_storage.jobs[mock_job.id].status == JobStatus.PENDING

    async def test_my_jobs_lists_only_mine_newest_first(
        self, client: TestClient, job_storage: FakeJobStorage
    ) -> None:
        older = TranscriptionJob(
            id="older", owner_sub=AUTHOR_SUB, created_at=datetime(2026, 9, 1, tzinfo=UTC)
        )
        newer = TranscriptionJob(
            id="newer", owner_sub=AUTHOR_SUB, created_at=datetime(2026, 9, 2, tzinfo=UTC)
        )
        theirs = TranscriptionJob(id="theirs", owner_sub="someone-else")
        for job in (older, newer, theirs):
            await job_storage.save(job)

        response = client.get("/api/transcribe/jobs")

        assert response.status_code == 200
        assert [job["job_id"] for job in response.json()["jobs"]] == ["newer", "older"]

    def test_my_jobs_limit_is_bounded(self, client: TestClient) -> None:
        assert client.get("/api/transcribe/jobs?limit=0").status_code == 422
        assert client.get("/api/transcribe/jobs?limit=101").status_code == 422
