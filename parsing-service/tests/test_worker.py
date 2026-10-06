from fakeredis import FakeAsyncRedis

from parsing.config import Settings
from parsing.models import Block, BlockKind
from parsing.sources import SourceProfile
from parsing.state import State
from parsing.worker import schedule_due
from tests.conftest import ProfileFactory


async def test_due_sources_are_enqueued_once_per_interval(
    make_profile: ProfileFactory, redis: FakeAsyncRedis, settings: Settings
) -> None:
    state = State(redis, settings)
    sources = [
        make_profile(key="every-minute"),
        make_profile(key="half-hourly", interval="PT30M"),
        make_profile(key="off", enabled=False),
    ]
    queued: list[str] = []

    async def enqueue(profile: SourceProfile) -> None:
        queued.append(profile.key)

    assert await schedule_due(sources, state, enqueue) == 2
    assert await schedule_due(sources, state, enqueue) == 0
    assert queued == ["every-minute", "half-hourly"]

    # The minute has passed for one of them
    await redis.delete("parsing:due:every-minute")
    await schedule_due(sources, state, enqueue)
    assert queued == ["every-minute", "half-hourly", "every-minute"]


async def test_paused_sources_wait(
    make_profile: ProfileFactory, redis: FakeAsyncRedis, settings: Settings
) -> None:
    state = State(redis, settings)
    await state.pause(
        "blocked",
        Block(kind=BlockKind.FORBIDDEN, http_status=403, url="https://example.com/a"),
    )
    queued: list[str] = []

    async def enqueue(profile: SourceProfile) -> None:
        queued.append(profile.key)

    await schedule_due([make_profile(key="blocked")], state, enqueue)

    assert queued == []
    # Not claimed either: the run comes as soon as the pause is over
    assert not await redis.exists("parsing:due:blocked")
