"""One run of one source: architecture/aggregator.md section 4.5."""

from dataclasses import dataclass
from datetime import UTC, datetime
from urllib.parse import urlsplit

import httpx
import structlog
from redis.asyncio import Redis

from parsing.adapters import ADAPTERS, FeedEntry
from parsing.config import Settings
from parsing.extract import ExtractionError, extract_article
from parsing.fetch import (
    BlockedError,
    Fetcher,
    FetchError,
    HostNotAllowedError,
    HostThrottle,
    TooLargeError,
    TooManyRedirectsError,
)
from parsing.health import HealthBook
from parsing.models import ExtractionStatus, Item, ItemChange, RunReport, RunStatus
from parsing.output import FileSink, Sink
from parsing.robots import Robots
from parsing.sources import SourceProfile
from parsing.state import RetryRecord, SeenRecord, State
from parsing.urls import canonical_url, host_allowed

logger = structlog.get_logger()

Log = structlog.typing.FilteringBoundLogger

# A page that may well answer next time: the site's own hiccup, not a verdict on the article
_TRANSIENT_STATUSES = frozenset({404, 408, 425, *range(500, 600)})
# Not worth asking again: the answer will be the same
_PERMANENT_ERRORS = (HostNotAllowedError, TooLargeError, TooManyRedirectsError)
# Retries done in one run of a source, on top of its new entries
_RETRIES_PER_RUN = 20


class RobotsDisallowedError(Exception):
    pass


@dataclass(frozen=True)
class Deps:
    fetcher: Fetcher
    robots: Robots
    state: State
    sink: Sink
    health: HealthBook


def build_deps(settings: Settings, client: httpx.AsyncClient, redis: Redis) -> Deps:
    fetcher = Fetcher(client, settings, HostThrottle(settings.host_delay))
    return Deps(
        fetcher=fetcher,
        robots=Robots(fetcher, settings.robots_ttl),
        state=State(redis, settings),
        sink=FileSink(settings.output_dir),
        health=HealthBook(redis, settings),
    )


async def run_source(
    profile: SourceProfile,
    deps: Deps,
    *,
    limit: int | None = None,
    ignore_seen: bool = False,
) -> RunReport:
    """Collect what is new at the source. Never raises: the outcome is in the report.

    limit caps the entries taken from the feed; ignore_seen collects seen ones again. Both are
    for checking a source on its last articles (architecture/aggregator.md section 4.3).
    """
    report = RunReport(source=profile.key, started_at=_now())
    log = logger.bind(source=profile.key)
    try:
        await _run(profile, deps, report, log, limit=limit, ignore_seen=ignore_seen)
    except BlockedError as error:
        report.status = RunStatus.BLOCKED
        report.block = error.block
        pause = await deps.state.pause(profile.key, error.block)
        log.warning(
            "source_blocked",
            kind=error.block.kind,
            http_status=error.block.http_status,
            url=error.block.url,
            pause_seconds=pause.total_seconds(),
        )
    except RobotsDisallowedError as error:
        report.status = RunStatus.ROBOTS
        report.error = f"robots.txt disallows {error}"
        log.warning("robots_disallowed", url=str(error))
    except Exception as error:
        # A failed run is reported and the worker goes on with the other sources
        report.status = RunStatus.FAILED
        report.error = f"{type(error).__name__}: {error}"
        log.exception("run_failed")
    else:
        await deps.state.resume(profile.key)
    report.finished_at = _now()
    await deps.sink.run(report)
    await deps.health.record(report)
    log.info(
        "run_finished",
        status=report.status,
        entries=report.entries,
        new=report.new,
        changed=report.changed,
        extraction_failed=report.extraction_failed,
        retried=report.retried,
        recovered=report.recovered,
    )
    return report


async def _run(
    profile: SourceProfile,
    deps: Deps,
    report: RunReport,
    log: Log,
    *,
    limit: int | None,
    ignore_seen: bool,
) -> None:
    await _run_feed(profile, deps, report, log, limit=limit, ignore_seen=ignore_seen)
    await _run_retries(profile, deps, report, log)


async def _run_feed(
    profile: SourceProfile,
    deps: Deps,
    report: RunReport,
    log: Log,
    *,
    limit: int | None,
    ignore_seen: bool,
) -> None:
    feed_url = str(profile.url)
    if not await _robots_allow(profile, feed_url, deps, log):
        raise RobotsDisallowedError(feed_url)

    validators = {} if ignore_seen else await deps.state.validators(profile.key)
    headers: dict[str, str] = {}
    if etag := validators.get("etag"):
        headers["If-None-Match"] = etag
    if last_modified := validators.get("last_modified"):
        headers["If-Modified-Since"] = last_modified
    response = await deps.fetcher.get(feed_url, profile.hosts, headers=headers)
    report.http_status = response.status
    if response.status == 304:
        report.status = RunStatus.NOT_MODIFIED
        return
    if response.status != 200:
        raise FetchError(f"feed answered {response.status}")

    entries = ADAPTERS[profile.kind](response.body, profile, response.charset)
    report.entries = len(entries)
    taken = 0
    for entry in entries:
        if limit is not None and taken >= limit:
            break
        url = canonical_url(entry.url)
        if not profile.wants(url):
            continue
        if not host_allowed(url, profile.hosts):
            log.warning("foreign_link", url=url)
            continue
        taken += 1
        if not ignore_seen:
            seen = await deps.state.seen(profile.key, url)
            if seen is not None:
                if await _record_change(profile, entry, url, seen, deps):
                    report.changed += 1
                continue

        item, html, retry = await _collect(profile, entry, url, deps, log)
        await deps.sink.item(item, html)
        await deps.state.mark_seen(
            profile.key, {url, item.url}, SeenRecord(entry.title, entry.published_at)
        )
        report.new += 1
        if item.extraction is ExtractionStatus.OK:
            report.extracted += 1
        elif item.extraction is ExtractionStatus.FAILED:
            report.extraction_failed += 1
            if retry:
                first = RetryRecord(url=url, attempt=1, item=item)
                await _schedule_retry(profile, first, deps, report, log)
            else:
                report.lost += 1

    # Saved last: a run cut short must not leave a 304 over the entries it did not get to
    await deps.state.save_validators(
        profile.key, response.headers.get("etag"), response.headers.get("last-modified")
    )


async def _run_retries(profile: SourceProfile, deps: Deps, report: RunReport, log: Log) -> None:
    """Pages that failed for a passing reason are asked again, apart from the feed.

    The item was written at once with its lead; a page that answers now writes it again with the
    text, under the same URL (architecture/aggregator.md section 4.4).
    """
    for record in await deps.state.due_retries(profile.key, _now(), _RETRIES_PER_RUN):
        report.retried += 1
        item = record.item.model_copy(deep=True)
        html, retry = await _fill_text(profile, item, record.url, deps, log)
        if item.extraction is ExtractionStatus.OK:
            await deps.sink.item(item, html)
            await deps.state.mark_seen(
                profile.key, [item.url], SeenRecord(item.title, item.published_at)
            )
            await deps.state.drop_retry(profile.key, record.url)
            report.recovered += 1
            report.extracted += 1
            log.info("retry_recovered", url=record.url, attempt=record.attempt)
        elif retry:
            next_record = RetryRecord(url=record.url, attempt=record.attempt + 1, item=record.item)
            await _schedule_retry(profile, next_record, deps, report, log)
        else:
            await deps.state.drop_retry(profile.key, record.url)
            report.lost += 1
            log.info("retry_dropped", url=record.url, error=item.extraction_error)


async def _schedule_retry(
    profile: SourceProfile, record: RetryRecord, deps: Deps, report: RunReport, log: Log
) -> None:
    delays = deps.state.retry_delays
    if record.attempt > len(delays):
        await deps.state.drop_retry(profile.key, record.url)
        report.lost += 1
        log.warning("retry_gave_up", url=record.url, attempts=len(delays))
        return
    await deps.state.schedule_retry(profile.key, record, _now() + delays[record.attempt - 1])


async def _record_change(
    profile: SourceProfile, entry: FeedEntry, url: str, seen: SeenRecord, deps: Deps
) -> bool:
    """A seen article with a new title or date is written down, not fetched again."""
    if seen.title == entry.title and seen.published_at == entry.published_at:
        return False
    await deps.sink.change(
        ItemChange(
            source=profile.key,
            url=url,
            seen_at=_now(),
            title_before=seen.title,
            title=entry.title,
            published_before=seen.published_at,
            published=entry.published_at,
        )
    )
    await deps.state.mark_seen(profile.key, [url], SeenRecord(entry.title, entry.published_at))
    return True


async def _collect(
    profile: SourceProfile, entry: FeedEntry, url: str, deps: Deps, log: Log
) -> tuple[Item, bytes | None, bool]:
    """A new item: lead from the feed, text from the page. The flag asks for a retry."""
    item = Item(
        source=profile.key,
        external_id=entry.external_id or url,
        url=url,
        title=entry.title,
        lead=entry.lead,
        author=entry.author,
        published_at=entry.published_at,
        first_seen_at=_now(),
        language=profile.language,
        categories=list(entry.categories),
        extraction=ExtractionStatus.SKIPPED,
    )
    if profile.content_mode == "lead":
        return item, None, False
    html, retry = await _fill_text(profile, item, url, deps, log)
    return item, html, retry


async def _fill_text(
    profile: SourceProfile, item: Item, url: str, deps: Deps, log: Log
) -> tuple[bytes | None, bool]:
    """Fetch the page at url and put its text into the item.

    Returns the page and whether a failure is worth retrying. A block is raised: it stops the
    run, the source is paused.
    """
    if not await _robots_allow(profile, url, deps, log):
        item.extraction = ExtractionStatus.SKIPPED
        item.extraction_error = "robots.txt"
        return None, False

    try:
        response = await deps.fetcher.get(url, profile.hosts)
    except BlockedError:
        raise
    except _PERMANENT_ERRORS as error:
        _failed(item, str(error))
        return None, False
    except FetchError as error:
        # Timeouts and dropped connections
        _failed(item, str(error))
        return None, True
    if response.status != 200:
        _failed(item, f"page answered {response.status}")
        return None, response.status in _TRANSIENT_STATUSES

    try:
        article = extract_article(response.body, response.url, profile.extract, response.charset)
    except ExtractionError as error:
        _failed(item, str(error))
        return response.body, False
    except Exception as error:
        # A page that breaks the extractor would otherwise fail every run at the same entry
        log.exception("extractor_crashed", url=url)
        _failed(item, f"{type(error).__name__}: {error}")
        return response.body, False

    item.url = _article_url(article.canonical_url, response.url, profile)
    item.text = article.text
    item.lead = item.lead or article.lead
    item.author = item.author or article.author
    item.image_url = article.image_url
    item.published_at = item.published_at or article.published
    item.categories = list(dict.fromkeys([*item.categories, *article.tags]))
    item.embeds = list(article.embeds)
    item.extraction = ExtractionStatus.OK
    item.extraction_error = None
    return response.body, False


def _article_url(declared: str | None, fetched: str, profile: SourceProfile) -> str:
    """The page's own canonical URL, if it is believable; else where the page was found."""
    if declared:
        canonical = canonical_url(declared)
        # A canonical pointing at the home page is a site template bug, not the article
        if host_allowed(canonical, profile.hosts) and urlsplit(canonical).path not in ("", "/"):
            return canonical
    return canonical_url(fetched)


def _failed(item: Item, error: str) -> Item:
    item.extraction = ExtractionStatus.FAILED
    item.extraction_error = error
    return item


async def _robots_allow(profile: SourceProfile, url: str, deps: Deps, log: Log) -> bool:
    if await deps.robots.allowed(url, profile.hosts):
        return True
    if profile.respect_robots:
        return False
    log.warning("robots_ignored", url=url)
    return True


def _now() -> datetime:
    return datetime.now(UTC)
