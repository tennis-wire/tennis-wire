import gzip
import json
from pathlib import Path
from typing import Any

import httpx
import pytest
import respx

from parsing.config import Settings
from parsing.models import BlockKind, ExtractionStatus, RunStatus
from parsing.pipeline import Deps, run_source
from parsing.sources import SourceProfile
from parsing.urls import url_digest
from tests.conftest import ProfileFactory

FEED = "https://news.example.com/feed"
A = "https://news.example.com/tennis/a"
B = "https://news.example.com/tennis/b"
BODY = (
    "The final went the distance, and the champion said afterwards that the crowd had carried "
    "her through the third set."
)


@pytest.fixture
def profile(make_profile: ProfileFactory) -> SourceProfile:
    return make_profile(url=FEED)


@pytest.fixture(autouse=True)
def no_robots_txt(respx_mock: respx.MockRouter) -> None:
    respx_mock.get("https://news.example.com/robots.txt").respond(404)


def rss(*items: tuple[str, str]) -> bytes:
    entries = "".join(
        f"<item><title>{title}</title><link>{link}?utm_source=rss</link><guid>{link}</guid>"
        f"<pubDate>Tue, 06 Oct 2026 12:40:06 +0000</pubDate>"
        f"<description>&lt;p&gt;Lead of {title}&lt;/p&gt;</description></item>"
        for title, link in items
    )
    return f'<?xml version="1.0"?><rss version="2.0"><channel>{entries}</channel></rss>'.encode()


def page(text: str = BODY, canonical: str | None = None) -> bytes:
    link = f'<link rel="canonical" href="{canonical}">' if canonical else ""
    return (
        f"<html><head><title>T</title>{link}</head>"
        f"<body><article><p>{text}</p><p>{text}</p></article></body></html>"
    ).encode()


def written(settings: Settings, name: str) -> list[dict[str, Any]]:
    lines: list[dict[str, Any]] = []
    for path in sorted(settings.output_dir.glob(name)):
        lines += [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines()]
    return lines


async def test_first_run_collects_the_entries(
    profile: SourceProfile, deps: Deps, settings: Settings, respx_mock: respx.MockRouter
) -> None:
    respx_mock.get(FEED).respond(200, content=rss(("A", A), ("B", B)), headers={"etag": '"1"'})
    respx_mock.get(A).respond(200, content=page())
    respx_mock.get(B).respond(200, content=page())

    report = await run_source(profile, deps)

    assert (report.status, report.http_status, report.entries, report.new) == (
        RunStatus.OK,
        200,
        2,
        2,
    )
    items = written(settings, "items-*.jsonl")
    assert [item["url"] for item in items] == [A, B]
    first = items[0]
    assert first["external_id"] == A
    assert first["title"] == "A"
    assert first["lead"] == "Lead of A"
    assert first["text"].startswith("The final went the distance")
    assert first["extraction"] == ExtractionStatus.OK
    assert first["language"] == "en"
    assert first["published_at"] == "2026-10-06T12:40:06Z"
    saved = settings.output_dir / "html" / "example" / f"{url_digest(A)}.html.gz"
    assert gzip.decompress(saved.read_bytes()) == page()
    assert [run["status"] for run in written(settings, "runs.jsonl")] == ["ok"]
    assert await deps.state.validators("example") == {"etag": '"1"'}


async def test_seen_entries_are_not_taken_again(
    profile: SourceProfile, deps: Deps, settings: Settings, respx_mock: respx.MockRouter
) -> None:
    respx_mock.get(FEED).respond(200, content=rss(("A", A)))
    page_route = respx_mock.get(A).respond(200, content=page())

    await run_source(profile, deps)
    report = await run_source(profile, deps)

    assert report.new == 0
    assert page_route.call_count == 1
    assert len(written(settings, "items-*.jsonl")) == 1


async def test_not_modified_feed(
    profile: SourceProfile, deps: Deps, respx_mock: respx.MockRouter
) -> None:
    def feed(request: httpx.Request) -> httpx.Response:
        if request.headers.get("if-none-match") == '"1"':
            return httpx.Response(304)
        return httpx.Response(200, content=rss(("A", A)), headers={"etag": '"1"'})

    respx_mock.get(FEED).mock(side_effect=feed)
    respx_mock.get(A).respond(200, content=page())

    await run_source(profile, deps)
    report = await run_source(profile, deps)

    assert (report.status, report.http_status) == (RunStatus.NOT_MODIFIED, 304)


async def test_a_changed_title_is_recorded_not_fetched(
    profile: SourceProfile, deps: Deps, settings: Settings, respx_mock: respx.MockRouter
) -> None:
    feed = respx_mock.get(FEED).respond(200, content=rss(("A", A)))
    page_route = respx_mock.get(A).respond(200, content=page())
    await run_source(profile, deps)

    feed.respond(200, content=rss(("A, corrected", A)))
    report = await run_source(profile, deps)

    assert (report.new, report.changed) == (0, 1)
    assert page_route.call_count == 1
    [change] = written(settings, "changes.jsonl")
    assert (change["url"], change["title_before"], change["title"]) == (A, "A", "A, corrected")
    # Recorded once, not on every run after
    assert (await run_source(profile, deps)).changed == 0


async def test_lead_only_source_fetches_no_pages(
    make_profile: ProfileFactory, deps: Deps, settings: Settings, respx_mock: respx.MockRouter
) -> None:
    respx_mock.get(FEED).respond(200, content=rss(("A", A)))
    page_route = respx_mock.get(A).respond(200, content=page())

    await run_source(make_profile(url=FEED, content_mode="lead"), deps)

    [item] = written(settings, "items-*.jsonl")
    assert (item["extraction"], item["text"], item["lead"]) == ("skipped", None, "Lead of A")
    assert not page_route.called


async def test_a_page_that_fails_keeps_the_lead(
    profile: SourceProfile, deps: Deps, settings: Settings, respx_mock: respx.MockRouter
) -> None:
    respx_mock.get(FEED).respond(200, content=rss(("A", A)))
    respx_mock.get(A).respond(500)

    report = await run_source(profile, deps)

    assert (report.status, report.new, report.extraction_failed) == (RunStatus.OK, 1, 1)
    [item] = written(settings, "items-*.jsonl")
    assert (item["extraction"], item["extraction_error"], item["lead"]) == (
        "failed",
        "page answered 500",
        "Lead of A",
    )


async def test_a_page_without_text_keeps_the_html(
    profile: SourceProfile, deps: Deps, settings: Settings, respx_mock: respx.MockRouter
) -> None:
    respx_mock.get(FEED).respond(200, content=rss(("A", A)))
    respx_mock.get(A).respond(200, content=b"<html><body></body></html>")

    await run_source(profile, deps)

    [item] = written(settings, "items-*.jsonl")
    assert item["extraction"] == "failed"
    assert (settings.output_dir / "html" / "example" / f"{url_digest(A)}.html.gz").exists()


async def test_an_extractor_crash_does_not_stall_the_source(
    profile: SourceProfile,
    deps: Deps,
    settings: Settings,
    respx_mock: respx.MockRouter,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def crash(*args: object, **kwargs: object) -> None:
        raise RuntimeError("tree too deep")

    monkeypatch.setattr("parsing.extract.trafilatura.extract", crash)
    respx_mock.get(FEED).respond(200, content=rss(("A", A), ("B", B)))
    respx_mock.get(A).respond(200, content=page())
    respx_mock.get(B).respond(200, content=page())

    report = await run_source(profile, deps)

    assert (report.status, report.new, report.extraction_failed) == (RunStatus.OK, 2, 2)
    assert [item["extraction_error"] for item in written(settings, "items-*.jsonl")] == [
        "RuntimeError: tree too deep"
    ] * 2


async def test_a_block_stops_the_run_and_pauses_the_source(
    profile: SourceProfile, deps: Deps, settings: Settings, respx_mock: respx.MockRouter
) -> None:
    respx_mock.get(FEED).respond(200, content=rss(("A", A), ("B", B)), headers={"etag": '"1"'})
    respx_mock.get(A).respond(403)
    page_b = respx_mock.get(B).respond(200, content=page())

    report = await run_source(profile, deps)

    assert report.status == RunStatus.BLOCKED
    assert report.block is not None
    assert (report.block.kind, report.block.url) == (BlockKind.FORBIDDEN, A)
    assert not page_b.called
    assert written(settings, "items-*.jsonl") == []
    assert await deps.state.paused("example")
    # The entries not reached are taken after the pause: no 304 may hide them
    assert await deps.state.validators("example") == {}
    assert await deps.state.seen("example", A) is None


async def test_robots_txt_respected_skips_pages(
    profile: SourceProfile, deps: Deps, settings: Settings, respx_mock: respx.MockRouter
) -> None:
    respx_mock.get("https://news.example.com/robots.txt").respond(
        200, text="User-agent: *\nDisallow: /tennis/\n"
    )
    respx_mock.get(FEED).respond(200, content=rss(("A", A)))
    page_route = respx_mock.get(A).respond(200, content=page())

    await run_source(profile, deps)

    [item] = written(settings, "items-*.jsonl")
    assert (item["extraction"], item["extraction_error"]) == ("skipped", "robots.txt")
    assert not page_route.called


async def test_robots_txt_ignored_by_the_profile(
    make_profile: ProfileFactory, deps: Deps, settings: Settings, respx_mock: respx.MockRouter
) -> None:
    respx_mock.get("https://news.example.com/robots.txt").respond(
        200, text="User-agent: *\nDisallow: /\n"
    )
    respx_mock.get(FEED).respond(200, content=rss(("A", A)))
    respx_mock.get(A).respond(200, content=page())

    report = await run_source(make_profile(url=FEED, respect_robots=False), deps)

    assert report.status == RunStatus.OK
    [item] = written(settings, "items-*.jsonl")
    assert item["extraction"] == "ok"


async def test_robots_txt_disallowing_the_feed(
    profile: SourceProfile, deps: Deps, respx_mock: respx.MockRouter
) -> None:
    respx_mock.get("https://news.example.com/robots.txt").respond(
        200, text="User-agent: *\nDisallow: /feed\n"
    )
    feed = respx_mock.get(FEED).respond(200, content=rss(("A", A)))

    report = await run_source(profile, deps)

    assert report.status == RunStatus.ROBOTS
    assert not feed.called


async def test_links_off_the_source_are_skipped(
    profile: SourceProfile, deps: Deps, settings: Settings, respx_mock: respx.MockRouter
) -> None:
    respx_mock.get(FEED).respond(
        200, content=rss(("Elsewhere", "https://tracker.other.org/a"), ("A", A))
    )
    respx_mock.get(A).respond(200, content=page())

    report = await run_source(profile, deps)

    assert report.new == 1
    assert [item["url"] for item in written(settings, "items-*.jsonl")] == [A]


async def test_profile_filters(
    make_profile: ProfileFactory, deps: Deps, settings: Settings, respx_mock: respx.MockRouter
) -> None:
    video = "https://news.example.com/tennis/clip_vid1"
    respx_mock.get(FEED).respond(200, content=rss(("Video", video), ("A", A)))
    respx_mock.get(A).respond(200, content=page())

    await run_source(make_profile(url=FEED, exclude=["_vid"]), deps)

    assert [item["url"] for item in written(settings, "items-*.jsonl")] == [A]


async def test_limit_and_ignore_seen(
    profile: SourceProfile, deps: Deps, respx_mock: respx.MockRouter
) -> None:
    respx_mock.get(FEED).respond(200, content=rss(("A", A), ("B", B)))
    respx_mock.get(A).respond(200, content=page())
    respx_mock.get(B).respond(200, content=page())

    assert (await run_source(profile, deps, limit=1)).new == 1
    assert (await run_source(profile, deps, limit=1)).new == 0
    assert (await run_source(profile, deps, limit=1, ignore_seen=True)).new == 1


async def test_a_failing_feed_is_reported(
    profile: SourceProfile, deps: Deps, settings: Settings, respx_mock: respx.MockRouter
) -> None:
    respx_mock.get(FEED).respond(500)

    report = await run_source(profile, deps)

    assert report.status == RunStatus.FAILED
    assert report.error == "FetchError: feed answered 500"
    assert [run["status"] for run in written(settings, "runs.jsonl")] == ["failed"]


async def test_the_page_canonical_url_is_kept(
    profile: SourceProfile, deps: Deps, settings: Settings, respx_mock: respx.MockRouter
) -> None:
    canonical = "https://news.example.com/tennis/a-final"
    respx_mock.get(FEED).respond(200, content=rss(("A", A)))
    respx_mock.get(A).respond(200, content=page(canonical=canonical))

    await run_source(profile, deps)

    [item] = written(settings, "items-*.jsonl")
    assert item["url"] == canonical
    assert await deps.state.seen("example", A) is not None
    assert await deps.state.seen("example", canonical) is not None


@pytest.mark.parametrize(
    "canonical", ["https://news.example.com/", "https://elsewhere.org/tennis/a"]
)
async def test_an_unbelievable_canonical_url_is_ignored(
    canonical: str,
    profile: SourceProfile,
    deps: Deps,
    settings: Settings,
    respx_mock: respx.MockRouter,
) -> None:
    respx_mock.get(FEED).respond(200, content=rss(("A", A)))
    respx_mock.get(A).respond(200, content=page(canonical=canonical))

    await run_source(profile, deps)

    [item] = written(settings, "items-*.jsonl")
    assert item["url"] == A


def test_written_reads_nothing_from_an_empty_dir(tmp_path: Path) -> None:
    settings = Settings(_env_file=None, output_dir=tmp_path)

    assert written(settings, "items-*.jsonl") == []
