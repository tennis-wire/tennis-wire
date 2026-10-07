from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest
from fakeredis import FakeAsyncRedis
from structlog.testing import capture_logs

from parsing import cli
from parsing.config import Settings
from parsing.health import HealthBook, ProblemKind
from parsing.models import Block, BlockKind, RunReport, RunStatus
from tests.conftest import ProfileFactory

T0 = datetime(2026, 10, 7, 12, 0, tzinfo=UTC)
BLOCK = Block(kind=BlockKind.CHALLENGE, http_status=403, url="https://example.com/feed")


def report(at: datetime, status: RunStatus = RunStatus.OK, **fields: object) -> RunReport:
    return RunReport.model_validate(
        {"source": "example", "started_at": at, "finished_at": at, "status": status, **fields}
    )


@pytest.fixture
def book(redis: FakeAsyncRedis, settings: Settings) -> HealthBook:
    return HealthBook(redis, settings)


async def test_a_good_run(book: HealthBook) -> None:
    await book.record(report(T0, new=2, extracted=2))
    await book.record(report(T0 + timedelta(minutes=1), RunStatus.NOT_MODIFIED))

    health = await book.get("example")

    assert health.first_run_at == T0
    assert health.last_run_at == T0 + timedelta(minutes=1)
    assert health.last_ok_at == T0 + timedelta(minutes=1)
    assert health.last_new_at == T0
    assert (health.failures_in_row, health.blocked_since, health.extracted) == (0, None, 2)


async def test_a_long_block_is_a_problem(book: HealthBook, make_profile: ProfileFactory) -> None:
    profile = make_profile()
    await book.record(report(T0, RunStatus.BLOCKED, block=BLOCK))
    await book.record(report(T0 + timedelta(minutes=30), RunStatus.BLOCKED, block=BLOCK))
    health = await book.get("example")

    # Blocked since the first block of the streak, not the latest
    assert health.blocked_since == T0
    assert book.judge(profile, health, T0 + timedelta(minutes=59)) == []
    [problem] = book.judge(profile, health, T0 + timedelta(hours=1))
    assert problem.kind is ProblemKind.BLOCKED
    assert "challenge" in problem.detail

    await book.record(report(T0 + timedelta(hours=2)))
    assert (await book.get("example")).blocked_since is None


async def test_runs_failing_in_a_row(book: HealthBook, make_profile: ProfileFactory) -> None:
    for minute in range(5):
        await book.record(report(T0 + timedelta(minutes=minute), RunStatus.FAILED))

    [problem] = book.judge(make_profile(), await book.get("example"), T0 + timedelta(minutes=5))

    assert problem.kind is ProblemKind.FAILING
    assert problem.detail == "5 runs in a row, last failed"


async def test_lost_pages(book: HealthBook, make_profile: ProfileFactory) -> None:
    profile = make_profile()
    await book.record(report(T0, new=19, extracted=13, lost=6))
    assert book.judge(profile, await book.get("example"), T0) == []

    await book.record(report(T0, new=1, extracted=1))
    [problem] = book.judge(profile, await book.get("example"), T0)
    assert problem.kind is ProblemKind.EXTRACTION
    assert problem.detail == "6 of the last 20 pages lost"


async def test_the_window_keeps_the_last_pages(book: HealthBook, settings: Settings) -> None:
    await book.record(report(T0, new=60, lost=60))
    await book.record(report(T0, new=10, extracted=10))

    health = await book.get("example")

    assert health.extracted + health.lost == settings.health_extraction_window
    assert health.extracted == 10


async def test_a_source_gone_quiet(book: HealthBook, make_profile: ProfileFactory) -> None:
    profile = make_profile(quiet_after="PT12H")
    await book.record(report(T0, new=1, extracted=1))
    await book.record(report(T0 + timedelta(hours=11), RunStatus.NOT_MODIFIED))
    health = await book.get("example")

    assert book.judge(profile, health, T0 + timedelta(hours=12)) == []
    [problem] = book.judge(profile, health, T0 + timedelta(hours=13))
    assert problem.kind is ProblemKind.QUIET


async def test_quiet_from_the_first_run_when_nothing_ever_came(
    book: HealthBook, make_profile: ProfileFactory
) -> None:
    await book.record(report(T0, RunStatus.NOT_MODIFIED))

    problems = book.judge(make_profile(), await book.get("example"), T0 + timedelta(days=2))

    assert [problem.kind for problem in problems] == [ProblemKind.QUIET]


async def test_changes_are_logged_once(book: HealthBook, make_profile: ProfileFactory) -> None:
    profile = make_profile()
    await book.record(report(T0, RunStatus.BLOCKED, block=BLOCK))
    later = T0 + timedelta(hours=2)

    with capture_logs() as logs:
        await book.check(profile, later)
        await book.check(profile, later + timedelta(minutes=1))
    assert [(log["event"], log["problem"]) for log in logs] == [("source_unhealthy", "blocked")]

    await book.record(report(later + timedelta(minutes=2), new=1))
    with capture_logs() as logs:
        await book.check(profile, later + timedelta(minutes=3))
    assert [(log["event"], log["problem"]) for log in logs] == [("source_recovered", "blocked")]


async def test_health_command(
    redis: FakeAsyncRedis,
    settings: Settings,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    sources = tmp_path / "sources.yaml"
    sources.write_text(
        "sources:\n"
        "  - {key: example, name: E, kind: rss, url: 'https://example.com/feed',"
        " hosts: [example.com], language: en, interval: PT1M}\n"
        "  - {key: switched-off, name: O, kind: rss, url: 'https://example.com/feed',"
        " hosts: [example.com], language: en, interval: PT1M, enabled: false}\n",
        encoding="utf-8",
    )
    settings = settings.model_copy(update={"sources_file": sources})
    long_ago = datetime.now(UTC) - timedelta(hours=3)
    await HealthBook(redis, settings).record(report(long_ago, RunStatus.BLOCKED, block=BLOCK))
    monkeypatch.setattr(cli.Redis, "from_url", lambda url: redis)
    monkeypatch.setattr(redis, "aclose", _noop)

    code = await cli._health(settings)

    out = capsys.readouterr().out
    assert code == 1
    assert "example" in out
    assert "blocked: challenge since" in out
    assert "disabled" in out


async def _noop() -> None:
    return None
