from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

import httpx
import pytest
import respx

from parsing.config import Settings
from parsing.models import ExtractionStatus, RunStatus
from parsing.pipeline import Deps, run_source
from parsing.sources import SourceProfile
from tests.conftest import ProfileFactory
from tests.test_pipeline import FEED, A, page, rss, written

START = datetime(2026, 10, 6, 12, 0, tzinfo=UTC)


@dataclass
class Clock:
    now: datetime

    def advance(self, **delta: float) -> None:
        self.now += timedelta(**delta)


@pytest.fixture
def clock(monkeypatch: pytest.MonkeyPatch) -> Clock:
    clock = Clock(START)
    monkeypatch.setattr("parsing.pipeline._now", lambda: clock.now)
    return clock


@pytest.fixture
def profile(make_profile: ProfileFactory) -> SourceProfile:
    return make_profile(url=FEED)


@pytest.fixture(autouse=True)
def no_robots_txt(respx_mock: respx.MockRouter) -> None:
    respx_mock.get("https://news.example.com/robots.txt").respond(404)


async def test_the_text_arrives_on_a_retry(
    profile: SourceProfile,
    deps: Deps,
    settings: Settings,
    clock: Clock,
    respx_mock: respx.MockRouter,
) -> None:
    respx_mock.get(FEED).respond(200, content=rss(("A", A)))
    respx_mock.get(A).mock(side_effect=[httpx.Response(503), httpx.Response(200, content=page())])

    first = await run_source(profile, deps)
    clock.advance(minutes=4)
    early = await run_source(profile, deps)
    clock.advance(minutes=2)
    second = await run_source(profile, deps)

    assert (first.new, first.extraction_failed, first.retried) == (1, 1, 0)
    # Not before its time
    assert early.retried == 0
    assert (second.new, second.retried, second.recovered) == (0, 1, 1)
    before, after = written(settings, "items-*.jsonl")
    assert (before["url"], before["extraction"], before["lead"]) == (A, "failed", "Lead of A")
    assert (after["url"], after["extraction"]) == (A, "ok")
    assert after["text"].startswith("The final went the distance")
    assert after["first_seen_at"] == before["first_seen_at"]
    assert after["extraction_error"] is None
    assert await deps.state.due_retries("example", START + timedelta(days=2), 10) == []


async def test_a_retry_does_not_need_the_feed(
    profile: SourceProfile,
    deps: Deps,
    settings: Settings,
    clock: Clock,
    respx_mock: respx.MockRouter,
) -> None:
    feed = respx_mock.get(FEED).respond(200, content=rss(("A", A)))
    respx_mock.get(A).mock(
        side_effect=[httpx.ConnectTimeout("slow"), httpx.Response(200, content=page())]
    )
    await run_source(profile, deps)

    # The article has left the feed, and the feed itself is not modified
    feed.respond(304)
    clock.advance(minutes=6)
    report = await run_source(profile, deps)

    assert (report.status, report.recovered) == (RunStatus.NOT_MODIFIED, 1)
    assert written(settings, "items-*.jsonl")[-1]["extraction"] == "ok"


async def test_retries_give_up(
    profile: SourceProfile,
    deps: Deps,
    settings: Settings,
    clock: Clock,
    respx_mock: respx.MockRouter,
) -> None:
    respx_mock.get(FEED).respond(200, content=rss(("A", A)))
    page_route = respx_mock.get(A).respond(502)

    await run_source(profile, deps)
    for delay in settings.retry_delays:
        clock.advance(seconds=delay.total_seconds() + 1)
        await run_source(profile, deps)
    clock.advance(days=1)
    last = await run_source(profile, deps)

    assert page_route.call_count == 1 + len(settings.retry_delays)
    assert last.retried == 0
    assert len(written(settings, "items-*.jsonl")) == 1


@pytest.mark.parametrize(
    "answer",
    [
        httpx.Response(410),
        httpx.Response(200, content=b"<html><body></body></html>"),
        httpx.Response(302, headers={"location": "https://elsewhere.org/a"}),
    ],
)
async def test_a_permanent_failure_is_not_retried(
    answer: httpx.Response,
    profile: SourceProfile,
    deps: Deps,
    settings: Settings,
    clock: Clock,
    respx_mock: respx.MockRouter,
) -> None:
    respx_mock.get(FEED).respond(200, content=rss(("A", A)))
    page_route = respx_mock.get(A).mock(return_value=answer)

    report = await run_source(profile, deps)
    clock.advance(hours=6)
    await run_source(profile, deps)

    assert report.extraction_failed == 1
    assert page_route.call_count == 1
    [item] = written(settings, "items-*.jsonl")
    assert item["extraction"] == ExtractionStatus.FAILED


async def test_a_block_on_a_retry_pauses_the_source(
    profile: SourceProfile,
    deps: Deps,
    clock: Clock,
    respx_mock: respx.MockRouter,
) -> None:
    respx_mock.get(FEED).respond(200, content=rss(("A", A)))
    respx_mock.get(A).mock(side_effect=[httpx.Response(503), httpx.Response(403)])
    await run_source(profile, deps)

    clock.advance(minutes=6)
    report = await run_source(profile, deps)

    assert report.status == RunStatus.BLOCKED
    assert await deps.state.paused("example")
    # Still queued: it is asked again after the pause
    assert len(await deps.state.due_retries("example", clock.now, 10)) == 1


async def test_lead_only_sources_have_nothing_to_retry(
    make_profile: ProfileFactory, deps: Deps, clock: Clock, respx_mock: respx.MockRouter
) -> None:
    respx_mock.get(FEED).respond(200, content=rss(("A", A)))

    await run_source(make_profile(url=FEED, content_mode="lead"), deps)

    assert await deps.state.due_retries("example", clock.now + timedelta(days=1), 10) == []
