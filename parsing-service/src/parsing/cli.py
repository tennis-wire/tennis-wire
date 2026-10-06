"""Command line: ``parsing run-once`` runs sources once without the worker.

``--limit 10 --ignore-seen`` is the check of a new source on its last ten articles
(architecture/aggregator.md section 4.3).
"""

import argparse
import asyncio
from collections.abc import Sequence

from redis.asyncio import Redis

from parsing.config import Settings, get_settings
from parsing.fetch import make_client
from parsing.logs import configure_logging
from parsing.models import RunStatus
from parsing.pipeline import build_deps, run_source
from parsing.sources import load_sources

_GOOD = (RunStatus.OK, RunStatus.NOT_MODIFIED)


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="parsing")
    commands = parser.add_subparsers(dest="command", required=True)
    once = commands.add_parser("run-once", help="run sources once, without the worker")
    once.add_argument(
        "--source", action="append", help="source key, repeatable; all enabled sources if omitted"
    )
    once.add_argument("--limit", type=int, help="take at most this many entries from each feed")
    once.add_argument(
        "--ignore-seen", action="store_true", help="collect entries already seen as well"
    )
    args = parser.parse_args(argv)

    settings = get_settings()
    configure_logging(settings)
    return asyncio.run(_run_once(settings, args.source, args.limit, args.ignore_seen))


async def _run_once(
    settings: Settings, keys: list[str] | None, limit: int | None, ignore_seen: bool
) -> int:
    sources = load_sources(settings.sources_file)
    unknown = sorted(set(keys or []) - sources.keys())
    if unknown:
        raise SystemExit(f"Unknown sources: {', '.join(unknown)}")
    profiles = (
        [sources[key] for key in keys] if keys else [p for p in sources.values() if p.enabled]
    )

    redis = Redis.from_url(str(settings.redis_url))
    async with make_client(settings) as client:
        try:
            deps = build_deps(settings, client, redis)
            reports = [
                await run_source(profile, deps, limit=limit, ignore_seen=ignore_seen)
                for profile in profiles
            ]
        finally:
            await redis.aclose()
    return 0 if all(report.status in _GOOD for report in reports) else 1
