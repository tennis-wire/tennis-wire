from datetime import UTC, datetime, timedelta

from fakeredis import FakeAsyncRedis

from parsing.config import Settings
from parsing.models import Block, BlockKind, ExtractionStatus, Item
from parsing.state import RetryRecord, SeenRecord, State

FORBIDDEN = Block(kind=BlockKind.FORBIDDEN, http_status=403, url="https://example.com/a")


async def test_validators(redis: FakeAsyncRedis, settings: Settings) -> None:
    state = State(redis, settings)
    assert await state.validators("s") == {}

    await state.save_validators("s", 'W/"1"', "Tue, 06 Oct 2026 11:27:13 GMT")
    assert await state.validators("s") == {
        "etag": 'W/"1"',
        "last_modified": "Tue, 06 Oct 2026 11:27:13 GMT",
    }

    await state.save_validators("s", None, None)
    assert await state.validators("s") == {}


async def test_seen(redis: FakeAsyncRedis, settings: Settings) -> None:
    state = State(redis, settings)
    when = datetime(2026, 10, 6, 12, 40, tzinfo=UTC)
    record = SeenRecord("Title", when)

    assert await state.seen("s", "https://example.com/a") is None
    await state.mark_seen("s", ["https://example.com/a", "https://example.com/b"], record)

    assert await state.seen("s", "https://example.com/a") == record
    assert await state.seen("s", "https://example.com/b") == record
    assert await state.seen("other", "https://example.com/a") is None
    ttl = await redis.ttl(next(iter(await redis.keys("parsing:seen:s:*"))))
    assert timedelta(days=29) < timedelta(seconds=ttl) <= settings.seen_ttl


async def test_claim_due_once_per_interval(redis: FakeAsyncRedis, settings: Settings) -> None:
    state = State(redis, settings)

    assert await state.claim_due("s", timedelta(minutes=1))
    assert not await state.claim_due("s", timedelta(minutes=1))
    # A little shorter than the interval, so the next tick finds it gone
    ttl_ms = await redis.pttl("parsing:due:s")
    assert 50_000 < ttl_ms <= 55_000


async def test_pauses_double_up_to_the_maximum(redis: FakeAsyncRedis, settings: Settings) -> None:
    state = State(redis, settings)

    pauses = [await state.pause("s", FORBIDDEN) for _ in range(8)]

    assert pauses[:3] == [timedelta(minutes=1), timedelta(minutes=2), timedelta(minutes=4)]
    assert pauses[-1] == timedelta(hours=1)
    assert await state.paused("s")

    await state.resume("s")
    assert await state.pause("s", FORBIDDEN) == timedelta(minutes=1)


async def test_retry_after_lengthens_the_pause(redis: FakeAsyncRedis, settings: Settings) -> None:
    state = State(redis, settings)
    block = Block(
        kind=BlockKind.TOO_MANY_REQUESTS,
        http_status=429,
        url="https://example.com/a",
        retry_after_seconds=600,
    )

    assert await state.pause("s", block) == timedelta(minutes=10)


async def test_retry_queue(redis: FakeAsyncRedis, settings: Settings) -> None:
    state = State(redis, settings)
    now = datetime(2026, 10, 6, 12, 0, tzinfo=UTC)
    item = Item(
        source="s",
        external_id="https://example.com/a",
        url="https://example.com/a",
        title="A",
        first_seen_at=now,
        language="en",
        extraction=ExtractionStatus.FAILED,
        extraction_error="page answered 503",
    )
    record = RetryRecord(url="https://example.com/a", attempt=2, item=item)

    await state.schedule_retry("s", record, now + timedelta(minutes=5))

    assert await state.due_retries("s", now, 10) == []
    assert await state.due_retries("s", now + timedelta(minutes=5), 10) == [record]
    await state.drop_retry("s", "https://example.com/a")
    assert await state.due_retries("s", now + timedelta(days=1), 10) == []
