"""Source health: problems bigger than a passing failure (architecture/aggregator.md 4.11).

Every run updates a source's record; the worker's tick judges all sources once a minute and logs
a problem when it appears and when it clears, not on every tick.
"""

from collections.abc import Awaitable
from dataclasses import dataclass
from datetime import UTC, datetime
from enum import StrEnum
from typing import cast

import structlog
from redis.asyncio import Redis

from parsing.config import Settings
from parsing.models import Block, RunReport, RunStatus
from parsing.sources import SourceProfile

logger = structlog.get_logger()

_PREFIX = "parsing"
_GOOD = (RunStatus.OK, RunStatus.NOT_MODIFIED)


class ProblemKind(StrEnum):
    # Refused for longer than health_blocked_after: an IP ban looks like this
    BLOCKED = "blocked"
    # Runs failing one after another for some other reason
    FAILING = "failing"
    # Too many pages lost: often a redesign the extraction rules no longer fit
    EXTRACTION = "extraction"
    # No new item for longer than the source's quiet_after: a moved feed, an empty sitemap
    QUIET = "quiet"


@dataclass(frozen=True)
class Problem:
    kind: ProblemKind
    detail: str


@dataclass(frozen=True)
class Health:
    source: str
    first_run_at: datetime | None
    last_run_at: datetime | None
    last_status: str | None
    last_ok_at: datetime | None
    last_new_at: datetime | None
    failures_in_row: int
    blocked_since: datetime | None
    block: Block | None
    extracted: int
    lost: int
    problems: frozenset[ProblemKind]

    @property
    def lost_share(self) -> float | None:
        total = self.extracted + self.lost
        return self.lost / total if total else None


class HealthBook:
    def __init__(self, redis: Redis, settings: Settings) -> None:
        self._redis = redis
        self._settings = settings

    async def record(self, report: RunReport) -> None:
        now = (report.finished_at or report.started_at).isoformat()
        key = f"{_PREFIX}:health:{report.source}"
        async with self._redis.pipeline(transaction=True) as pipe:
            pipe.hsetnx(key, "first_run_at", now)
            pipe.hset(key, mapping={"last_run_at": now, "last_status": str(report.status)})
            if report.status in _GOOD:
                pipe.hset(key, mapping={"last_ok_at": now, "failures_in_row": 0})
                pipe.hdel(key, "blocked_since", "block")
            else:
                pipe.hincrby(key, "failures_in_row", 1)
                if report.block is not None:
                    pipe.hsetnx(key, "blocked_since", now)
                    pipe.hset(key, "block", report.block.model_dump_json())
            if report.new:
                pipe.hset(key, "last_new_at", now)
            outcomes = ["1"] * report.extracted + ["0"] * report.lost
            if outcomes:
                window = f"{_PREFIX}:extractions:{report.source}"
                pipe.lpush(window, *outcomes)
                pipe.ltrim(window, 0, self._settings.health_extraction_window - 1)
            await pipe.execute()

    async def get(self, source: str) -> Health:
        fields = await cast(
            Awaitable[dict[bytes, bytes]], self._redis.hgetall(f"{_PREFIX}:health:{source}")
        )
        raw = {_text(name): _text(value) for name, value in fields.items()}
        window = [
            _text(value)
            for value in await cast(
                Awaitable[list[bytes]],
                self._redis.lrange(f"{_PREFIX}:extractions:{source}", 0, -1),
            )
        ]
        block = raw.get("block")
        problems = raw.get("problems", "")
        return Health(
            source=source,
            first_run_at=_when(raw.get("first_run_at")),
            last_run_at=_when(raw.get("last_run_at")),
            last_status=raw.get("last_status"),
            last_ok_at=_when(raw.get("last_ok_at")),
            last_new_at=_when(raw.get("last_new_at")),
            failures_in_row=int(raw.get("failures_in_row", 0)),
            blocked_since=_when(raw.get("blocked_since")),
            block=Block.model_validate_json(block) if block else None,
            extracted=window.count("1"),
            lost=window.count("0"),
            problems=frozenset(ProblemKind(kind) for kind in problems.split(",") if kind),
        )

    def judge(self, profile: SourceProfile, health: Health, now: datetime) -> list[Problem]:
        settings = self._settings
        problems: list[Problem] = []
        if health.blocked_since and now - health.blocked_since >= settings.health_blocked_after:
            kind = health.block.kind if health.block else "unknown"
            problems.append(
                Problem(ProblemKind.BLOCKED, f"{kind} since {health.blocked_since.isoformat()}")
            )
        elif health.failures_in_row >= settings.health_failures_in_row:
            problems.append(
                Problem(
                    ProblemKind.FAILING,
                    f"{health.failures_in_row} runs in a row, last {health.last_status}",
                )
            )
        share = health.lost_share
        if (
            share is not None
            and health.extracted + health.lost >= settings.health_extraction_min
            and share >= settings.health_extraction_lost_share
        ):
            problems.append(
                Problem(
                    ProblemKind.EXTRACTION,
                    f"{health.lost} of the last {health.extracted + health.lost} pages lost",
                )
            )
        since = health.last_new_at or health.first_run_at
        if since and now - since > profile.quiet_after:
            problems.append(Problem(ProblemKind.QUIET, f"nothing new since {since.isoformat()}"))
        return problems

    async def check(self, profile: SourceProfile, now: datetime | None = None) -> list[Problem]:
        """Judge a source and log what changed since the last check."""
        now = now or datetime.now(UTC)
        health = await self.get(profile.key)
        problems = self.judge(profile, health, now)
        current = frozenset(problem.kind for problem in problems)
        if current != health.problems:
            for problem in problems:
                if problem.kind not in health.problems:
                    logger.warning(
                        "source_unhealthy",
                        source=profile.key,
                        problem=problem.kind,
                        detail=problem.detail,
                    )
            for kind in sorted(health.problems - current):
                logger.info("source_recovered", source=profile.key, problem=kind)
            await cast(
                Awaitable[int],
                self._redis.hset(
                    f"{_PREFIX}:health:{profile.key}", "problems", ",".join(sorted(current))
                ),
            )
        return problems


def _when(value: str | None) -> datetime | None:
    return datetime.fromisoformat(value) if value else None


def _text(value: bytes | str) -> str:
    return value.decode("utf-8") if isinstance(value, bytes) else value
