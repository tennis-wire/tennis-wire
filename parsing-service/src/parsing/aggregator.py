"""The aggregator, from the collector's side (architecture/aggregator.md 5.1).

News go to POST /internal/items one at a time, right after each is read: the order "written, then
marked seen" holds, and an aggregator that does not answer fails the run, so nothing is marked seen
that did not arrive. The catalog and the health snapshots follow sources.yaml and the health book.
"""

import asyncio
import json
from collections.abc import Iterable, Sequence
from datetime import datetime
from time import monotonic
from typing import Any
from urllib.parse import urlsplit

import httpx
import structlog

from parsing.config import Settings
from parsing.health import Health, HealthBook, Problem
from parsing.models import Item, ItemChange, RunReport
from parsing.sources import SourceProfile

logger = structlog.get_logger()

# The aggregator's limits: what is longer is cut here rather than have the item turned away
_LIMITS = {"title": 1000, "lead": 10_000, "text": 200_000, "author": 500, "extraction_error": 2000}
_LIST_ENTRIES = 50
_CATEGORY_LENGTH = 300
_URL_LENGTH = 2000


class AggregatorError(Exception):
    """The aggregator or Keycloak did not answer, or did not take the request."""


class ServiceToken:
    """The collector's own token, kept until shortly before it expires."""

    # Asked for again this long before the expiry Keycloak gave
    _MARGIN_SECONDS = 30

    def __init__(self, client: httpx.AsyncClient, settings: Settings) -> None:
        self._client = client
        self._settings = settings
        self._lock = asyncio.Lock()
        self._token: str | None = None
        self._expires = 0.0

    async def get(self) -> str:
        async with self._lock:
            if self._token is not None and monotonic() < self._expires:
                return self._token
            form = {
                "grant_type": "client_credentials",
                "client_id": self._settings.client_id,
                "client_secret": self._settings.client_secret.get_secret_value(),
            }
            try:
                response = await self._client.post(self._settings.token_url, data=form)
            except httpx.HTTPError as error:
                raise AggregatorError(f"token: {type(error).__name__}: {error}") from error
            if response.status_code != 200:
                raise AggregatorError(f"token endpoint answered {response.status_code}")
            body = response.json()
            self._token = str(body["access_token"])
            lifetime = int(body.get("expires_in", 60))
            self._expires = monotonic() + max(lifetime - self._MARGIN_SECONDS, 0)
            return self._token

    def forget(self) -> None:
        self._token = None


class AggregatorClient:
    def __init__(self, client: httpx.AsyncClient, token: ServiceToken) -> None:
        self._client = client
        self._token = token

    async def send_items(self, items: Sequence[dict[str, Any]]) -> list[dict[str, Any]]:
        response = await self._send("POST", "/internal/items", {"items": list(items)})
        if response.status_code != 200:
            raise AggregatorError(f"items answered {response.status_code}")
        results: list[dict[str, Any]] = response.json()["results"]
        return results

    async def send_sources(self, entries: Sequence[dict[str, str]]) -> None:
        response = await self._send("PUT", "/internal/sources", {"sources": list(entries)})
        if response.status_code != 204:
            raise AggregatorError(f"sources answered {response.status_code}")

    async def send_health(self, key: str, snapshot: dict[str, Any]) -> bool:
        """False when the aggregator does not know the source: the catalog is to be sent again."""
        response = await self._send("PUT", f"/internal/sources/{key}/health", snapshot)
        if response.status_code == 404:
            return False
        if response.status_code != 204:
            raise AggregatorError(f"health of {key} answered {response.status_code}")
        return True

    async def _send(self, method: str, path: str, body: object) -> httpx.Response:
        # A token Keycloak has since revoked or rotated: asked for once more, then given up
        for attempt in range(2):
            headers = {"Authorization": f"Bearer {await self._token.get()}"}
            try:
                response = await self._client.request(method, path, json=body, headers=headers)
            except httpx.HTTPError as error:
                raise AggregatorError(f"{path}: {type(error).__name__}: {error}") from error
            if response.status_code != 401 or attempt == 1:
                return response
            self._token.forget()
        raise AssertionError("unreachable")


class AggregatorSink:
    """The worker's sink. A rejected item is logged and taken as delivered: sending it again would
    be rejected again."""

    def __init__(self, client: AggregatorClient) -> None:
        self._client = client

    async def item(self, item: Item, html: bytes | None, *, update: bool = False) -> None:
        [result] = await self._client.send_items([item_payload(item, update=update)])
        _log_outcome(item.source, item.url, result)

    async def change(self, change: ItemChange) -> None:
        payload = {
            "change": "update",
            "url": change.url,
            "title": _cut(change.title, "title"),
            "publishedAt": _iso(change.published),
        }
        [result] = await self._client.send_items([payload])
        _log_outcome(change.source, change.url, result)

    async def run(self, report: RunReport) -> None:
        # Run reports stay in the collector's log; the aggregator gets the health snapshots
        return None


class CatalogPublisher:
    """Keeps the aggregator's catalog in step with sources.yaml, and the health of each source.

    Called on every tick. The list goes when it changes and on the first tick; a snapshot when the
    source's problems change, and at least every health_resend. What fails goes on the next tick.
    """

    def __init__(self, client: AggregatorClient, settings: Settings) -> None:
        self._client = client
        self._resend = settings.health_resend.total_seconds()
        self._registered: str | None = None
        self._sent: dict[str, tuple[frozenset[str], float]] = {}

    async def publish(
        self, profiles: Iterable[SourceProfile], book: HealthBook, now: datetime
    ) -> None:
        enabled = [profile for profile in profiles if profile.enabled]
        if not enabled:
            # The aggregator refuses an empty list: it would retire everything
            return
        entries = [source_entry(profile) for profile in enabled]
        fingerprint = json.dumps(entries, sort_keys=True)
        try:
            if fingerprint != self._registered:
                await self._client.send_sources(entries)
                self._registered = fingerprint
                self._sent.clear()
                logger.info("catalog_sent", sources=len(entries))
            for profile in enabled:
                health = await book.get(profile.key)
                problems = book.judge(profile, health, now)
                kinds = frozenset(problem.kind for problem in problems)
                last = self._sent.get(profile.key)
                if last is not None and last[0] == kinds and monotonic() - last[1] < self._resend:
                    continue
                if not await self._client.send_health(
                    profile.key, health_snapshot(health, problems)
                ):
                    self._registered = None
                    return
                self._sent[profile.key] = (kinds, monotonic())
        except AggregatorError as error:
            logger.warning("catalog_not_sent", error=str(error))


def item_payload(item: Item, *, update: bool) -> dict[str, Any]:
    """The item as POST /internal/items takes it, cut to the aggregator's limits."""
    return {
        "change": "update" if update else "new",
        "url": item.url,
        "source": item.source,
        "externalId": item.external_id[:_URL_LENGTH],
        "title": _cut(item.title, "title"),
        "lead": _cut(item.lead, "lead"),
        "text": _cut(item.text, "text"),
        "author": _cut(item.author, "author"),
        "imageUrl": item.image_url
        if item.image_url and len(item.image_url) <= _URL_LENGTH
        else None,
        "publishedAt": _iso(item.published_at),
        "firstSeenAt": _iso(item.first_seen_at),
        "language": item.language,
        "categories": [c[:_CATEGORY_LENGTH] for c in item.categories if c][:_LIST_ENTRIES],
        "embeds": [e for e in item.embeds if len(e) <= _URL_LENGTH][:_LIST_ENTRIES],
        "extraction": str(item.extraction),
        "extractionError": _cut(item.extraction_error, "extraction_error"),
    }


def source_entry(profile: SourceProfile) -> dict[str, str]:
    parts = urlsplit(str(profile.url))
    return {
        "key": profile.key,
        "name": profile.name[:200],
        "language": profile.language,
        "siteUrl": f"{parts.scheme}://{parts.netloc}/",
    }


def health_snapshot(health: Health, problems: Sequence[Problem]) -> dict[str, Any]:
    return {
        "problems": [{"kind": str(p.kind), "detail": p.detail[:500]} for p in problems],
        "lastRunAt": _iso(health.last_run_at),
        "lastStatus": health.last_status,
        "lastOkAt": _iso(health.last_ok_at),
        "lastNewAt": _iso(health.last_new_at),
        "failuresInRow": health.failures_in_row,
        "blockedSince": _iso(health.blocked_since),
        "blockKind": str(health.block.kind) if health.block else None,
    }


def make_aggregator_client(settings: Settings) -> httpx.AsyncClient:
    return httpx.AsyncClient(
        base_url=settings.aggregator_url,
        timeout=settings.aggregator_timeout.total_seconds(),
    )


def _log_outcome(source: str, url: str, result: dict[str, Any]) -> None:
    if result.get("outcome") == "rejected":
        logger.warning("item_rejected", source=source, url=url, reason=result.get("reason"))


def _cut(value: str | None, field: str) -> str | None:
    return value[: _LIMITS[field]] if value is not None else None


def _iso(value: datetime | None) -> str | None:
    return value.isoformat() if value else None
