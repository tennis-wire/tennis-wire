"""The transcription task, up to where it needs media."""

from collections.abc import AsyncIterator

import pytest
from fakeredis import FakeAsyncRedis
from structlog.testing import CapturingLogger

from tests.conftest import AUTHOR_SUB
from transcription.config import Settings
from transcription.models import JobStatus, TranscriptionJob
from transcription.storage.jobs import JobStorage
from transcription.worker import tasks


@pytest.fixture
async def redis() -> AsyncIterator[FakeAsyncRedis]:
    client = FakeAsyncRedis()
    yield client
    await client.aclose()


async def test_start_is_logged_by_owner_sub(
    redis: FakeAsyncRedis, settings: Settings, monkeypatch: pytest.MonkeyPatch
) -> None:
    log = CapturingLogger()
    monkeypatch.setattr(tasks, "logger", log)
    monkeypatch.setattr(tasks, "get_settings", lambda: settings)
    # No source: the task stops right after the start line, before any download
    await JobStorage(redis).create(TranscriptionJob(id="job-1", owner_sub=AUTHOR_SUB))

    await tasks.transcribe({"redis": redis, "transcriber": None}, "job-1")

    [started] = [call for call in log.calls if call.args == ("Transcription started",)]
    assert started.kwargs["owner"] == AUTHOR_SUB
    job = await JobStorage(redis).get("job-1")
    assert job is not None
    assert job.status == JobStatus.FAILED
