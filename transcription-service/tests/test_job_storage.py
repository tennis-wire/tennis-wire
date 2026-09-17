"""JobStorage against an in-process Redis."""

from collections.abc import AsyncIterator
from datetime import UTC, datetime, timedelta

import pytest
from fakeredis import FakeAsyncRedis

from transcription.models import TranscriptionJob
from transcription.storage.jobs import OWNER_INDEX_TTL_SECONDS, JobStorage

START = datetime(2026, 9, 17, 12, 0, tzinfo=UTC)


@pytest.fixture
async def redis() -> AsyncIterator[FakeAsyncRedis]:
    client = FakeAsyncRedis()
    yield client
    await client.aclose()


@pytest.fixture
def storage(redis: FakeAsyncRedis) -> JobStorage:
    return JobStorage(redis)


def job(job_id: str, owner: str = "author-a", minutes: int = 0) -> TranscriptionJob:
    return TranscriptionJob(
        id=job_id, owner_sub=owner, created_at=START + timedelta(minutes=minutes)
    )


async def test_lists_the_owners_jobs_newest_first(storage: JobStorage) -> None:
    for item in (job("first"), job("second", minutes=1), job("elsewhere", owner="author-b")):
        await storage.create(item)

    listed = await storage.list_for_owner("author-a", limit=10)

    assert [item.id for item in listed] == ["second", "first"]


async def test_limit_takes_the_newest(storage: JobStorage) -> None:
    for minute in range(3):
        await storage.create(job(f"job-{minute}", minutes=minute))

    listed = await storage.list_for_owner("author-a", limit=2)

    assert [item.id for item in listed] == ["job-2", "job-1"]


async def test_progress_updates_do_not_touch_the_index(
    storage: JobStorage, redis: FakeAsyncRedis
) -> None:
    created = job("running")
    await storage.create(created)
    created.progress = 40
    await storage.save(created)

    assert await redis.zcard("transcription:owner:author-a") == 1
    assert (await storage.list_for_owner("author-a", limit=10))[0].progress == 40


async def test_an_expired_job_leaves_the_index_on_read(
    storage: JobStorage, redis: FakeAsyncRedis
) -> None:
    await storage.create(job("kept"))
    await storage.create(job("expired", minutes=1))
    await redis.delete("transcription:job:expired")

    listed = await storage.list_for_owner("author-a", limit=10)

    assert [item.id for item in listed] == ["kept"]
    assert await redis.zrange("transcription:owner:author-a", 0, -1) == [b"kept"]


async def test_the_index_expires(storage: JobStorage, redis: FakeAsyncRedis) -> None:
    await storage.create(job("any"))

    ttl = await redis.ttl("transcription:owner:author-a")

    assert 0 < ttl <= OWNER_INDEX_TTL_SECONDS


async def test_nothing_listed_for_a_stranger(storage: JobStorage) -> None:
    assert await storage.list_for_owner("nobody", limit=10) == []
