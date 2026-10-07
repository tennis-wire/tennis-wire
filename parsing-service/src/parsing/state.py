"""Collector state in Redis: feed validators, seen articles, schedule, pauses after a block."""

import json
from collections.abc import Awaitable, Iterable
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import cast

from redis.asyncio import Redis

from parsing.config import Settings
from parsing.models import Block, Item
from parsing.urls import url_digest

_PREFIX = "parsing"
# A due mark lives this much less than the interval: the tick exactly one interval later
# must find it gone, not still there by a few milliseconds
_DUE_MARGIN = timedelta(seconds=5)
_PAUSE_LEVEL_TTL = timedelta(days=1)


@dataclass(frozen=True)
class SeenRecord:
    title: str
    published_at: datetime | None


@dataclass(frozen=True)
class RetryRecord:
    """A page to ask again: where to fetch it, which attempt this is, the item as written."""

    url: str
    attempt: int
    item: Item


class State:
    def __init__(self, redis: Redis, settings: Settings) -> None:
        self._redis = redis
        self._settings = settings

    async def validators(self, source: str) -> dict[str, str]:
        raw = await cast(
            Awaitable[dict[bytes, bytes]], self._redis.hgetall(f"{_PREFIX}:validators:{source}")
        )
        return {_text(name): _text(value) for name, value in raw.items()}

    async def save_validators(
        self, source: str, etag: str | None, last_modified: str | None
    ) -> None:
        name = f"{_PREFIX}:validators:{source}"
        fields = {
            field: value
            for field, value in (("etag", etag), ("last_modified", last_modified))
            if value
        }
        async with self._redis.pipeline(transaction=True) as pipe:
            pipe.delete(name)
            if fields:
                pipe.hset(name, mapping=fields)
            await pipe.execute()

    async def seen(self, source: str, url: str) -> SeenRecord | None:
        raw = await self._redis.get(self._seen_key(source, url))
        if raw is None:
            return None
        data = json.loads(raw)
        published = data.get("published_at")
        return SeenRecord(
            title=data["title"],
            published_at=datetime.fromisoformat(published) if published else None,
        )

    async def mark_seen(self, source: str, urls: Iterable[str], record: SeenRecord) -> None:
        payload = json.dumps(
            {
                "title": record.title,
                "published_at": record.published_at.isoformat() if record.published_at else None,
            }
        )
        async with self._redis.pipeline(transaction=False) as pipe:
            for url in set(urls):
                pipe.set(self._seen_key(source, url), payload, ex=self._settings.seen_ttl)
            await pipe.execute()

    async def claim_due(self, source: str, interval: timedelta) -> bool:
        """True once per interval: the scheduler enqueues a run only then."""
        ttl = max(interval - _DUE_MARGIN, timedelta(seconds=1))
        return bool(await self._redis.set(f"{_PREFIX}:due:{source}", "1", nx=True, px=ttl))

    async def paused(self, source: str) -> bool:
        return bool(await self._redis.exists(f"{_PREFIX}:pause:{source}"))

    async def pause(self, source: str, block: Block) -> timedelta:
        """Pause runs after a block: doubles from pause_min to pause_max, or Retry-After."""
        level_key = f"{_PREFIX}:pause-level:{source}"
        level = int(await self._redis.incr(level_key))
        await self._redis.expire(level_key, _PAUSE_LEVEL_TTL)
        pause = min(self._settings.pause_min * (1 << (level - 1)), self._settings.pause_max)
        if block.retry_after_seconds:
            pause = max(pause, timedelta(seconds=block.retry_after_seconds))
        await self._redis.set(f"{_PREFIX}:pause:{source}", block.model_dump_json(), ex=pause)
        return pause

    @property
    def retry_delays(self) -> tuple[timedelta, ...]:
        return self._settings.retry_delays

    async def schedule_retry(self, source: str, record: RetryRecord, when: datetime) -> None:
        digest = url_digest(record.url)
        payload = json.dumps(
            {
                "url": record.url,
                "attempt": record.attempt,
                "item": record.item.model_dump(mode="json"),
            }
        )
        # Outlives the last attempt, so a record never lingers if the source is switched off
        ttl = sum(self._settings.retry_delays, timedelta()) + timedelta(days=1)
        async with self._redis.pipeline(transaction=True) as pipe:
            pipe.set(f"{_PREFIX}:retry:{source}:{digest}", payload, ex=ttl)
            pipe.zadd(f"{_PREFIX}:retries:{source}", {digest: when.timestamp()})
            await pipe.execute()

    async def due_retries(self, source: str, now: datetime, limit: int) -> list[RetryRecord]:
        queue = f"{_PREFIX}:retries:{source}"
        digests = await self._redis.zrangebyscore(
            queue, "-inf", now.timestamp(), start=0, num=limit
        )
        records: list[RetryRecord] = []
        for digest in digests:
            raw = await self._redis.get(f"{_PREFIX}:retry:{source}:{_text(digest)}")
            if raw is None:
                await self._redis.zrem(queue, digest)
                continue
            data = json.loads(raw)
            records.append(
                RetryRecord(
                    url=data["url"],
                    attempt=data["attempt"],
                    item=Item.model_validate(data["item"]),
                )
            )
        return records

    async def drop_retry(self, source: str, url: str) -> None:
        digest = url_digest(url)
        async with self._redis.pipeline(transaction=True) as pipe:
            pipe.delete(f"{_PREFIX}:retry:{source}:{digest}")
            pipe.zrem(f"{_PREFIX}:retries:{source}", digest)
            await pipe.execute()

    async def resume(self, source: str) -> None:
        """A run went through: the next block starts the pauses from the shortest again."""
        await self._redis.delete(f"{_PREFIX}:pause-level:{source}")

    @staticmethod
    def _seen_key(source: str, url: str) -> str:
        return f"{_PREFIX}:seen:{source}:{url_digest(url)}"


def _text(value: bytes | str) -> str:
    return value.decode("utf-8") if isinstance(value, bytes) else value
