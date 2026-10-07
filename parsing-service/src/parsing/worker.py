"""arq worker: a tick once a minute enqueues the sources that are due, one job per source.

Run with ``uv run arq parsing.worker.WorkerSettings``.
"""

from collections.abc import Awaitable, Callable, Iterable
from typing import Any, ClassVar

import structlog
from arq.connections import ArqRedis, RedisSettings
from arq.cron import cron
from arq.worker import func

from parsing.config import get_settings
from parsing.fetch import make_client
from parsing.logs import configure_logging
from parsing.pipeline import Deps, build_deps, run_source
from parsing.sources import SourceProfile, load_sources
from parsing.state import State

logger = structlog.get_logger()

# A queue of its own: the transcription worker takes jobs from arq's default one
QUEUE_NAME = "arq:parsing"
FETCH_TASK = "fetch_source"

Enqueue = Callable[[SourceProfile], Awaitable[object]]


async def schedule_due(sources: Iterable[SourceProfile], state: State, enqueue: Enqueue) -> int:
    """Enqueue every enabled, unpaused source whose interval has passed. Returns how many."""
    queued = 0
    for profile in sources:
        if not profile.enabled or await state.paused(profile.key):
            continue
        if await state.claim_due(profile.key, profile.interval):
            await enqueue(profile)
            queued += 1
    return queued


async def tick(ctx: dict[str, Any]) -> None:
    settings = get_settings()
    deps: Deps = ctx["deps"]
    redis: ArqRedis = ctx["redis"]

    async def enqueue(profile: SourceProfile) -> object:
        # The job id keeps two runs of one source from overlapping; results are not kept, so
        # the id is free again as soon as the run ends
        return await redis.enqueue_job(
            FETCH_TASK, profile.key, _job_id=f"fetch:{profile.key}", _queue_name=QUEUE_NAME
        )

    sources = load_sources(settings.sources_file)
    await schedule_due(sources.values(), deps.state, enqueue)
    for profile in sources.values():
        if profile.enabled:
            await deps.health.check(profile)


async def fetch_source(ctx: dict[str, Any], key: str) -> None:
    profile = load_sources(get_settings().sources_file).get(key)
    if profile is None or not profile.enabled:
        logger.info("source_gone", source=key)
        return
    await run_source(profile, ctx["deps"])


async def startup(ctx: dict[str, Any]) -> None:
    settings = get_settings()
    configure_logging(settings)
    client = make_client(settings)
    ctx["client"] = client
    ctx["deps"] = build_deps(settings, client, ctx["redis"])
    logger.info("worker_started", sources_file=str(settings.sources_file))


async def shutdown(ctx: dict[str, Any]) -> None:
    await ctx["client"].aclose()


def _build_worker_settings() -> type[object]:
    """Built lazily, as in transcription-service: importing the module reads no configuration."""
    settings = get_settings()

    class WorkerSettings:
        functions: ClassVar = [func(fetch_source, name=FETCH_TASK, keep_result=0, max_tries=1)]
        cron_jobs: ClassVar = [cron(tick, name="tick", second=0, run_at_startup=True)]
        on_startup = startup
        on_shutdown = shutdown
        queue_name = QUEUE_NAME
        redis_settings = RedisSettings.from_dsn(str(settings.redis_url))
        # Jobs wait on the network; the host throttle keeps each site to one request at a time
        max_jobs = 20
        job_timeout = 600
        health_check_interval = 60

    return WorkerSettings


def __getattr__(name: str) -> object:
    if name == "WorkerSettings":
        return _build_worker_settings()
    raise AttributeError(name)
