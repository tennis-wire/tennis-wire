"""robots.txt, cached per origin. Whether to obey it is the source's call (respect_robots)."""

from collections.abc import Sequence
from datetime import timedelta
from time import monotonic
from urllib.parse import urlsplit
from urllib.robotparser import RobotFileParser

import structlog

from parsing.config import BOT_NAME
from parsing.fetch import Fetcher, FetchError

logger = structlog.get_logger()

# An origin whose robots.txt could not be read is asked again sooner than a readable one
_UNREACHABLE_TTL = timedelta(minutes=10)

# Parsed rules, or a blanket answer: True allows everything, False nothing
_Rules = RobotFileParser | bool


class Robots:
    def __init__(self, fetcher: Fetcher, ttl: timedelta) -> None:
        self._fetcher = fetcher
        self._ttl = ttl
        self._cache: dict[str, tuple[float, _Rules]] = {}

    async def allowed(self, url: str, hosts: Sequence[str]) -> bool:
        parts = urlsplit(url)
        origin = f"{parts.scheme}://{parts.netloc}"
        cached = self._cache.get(origin)
        if cached is None or cached[0] < monotonic():
            rules, ttl = await self._load(origin, hosts)
            cached = (monotonic() + ttl.total_seconds(), rules)
            self._cache[origin] = cached
        rules = cached[1]
        return rules if isinstance(rules, bool) else rules.can_fetch(BOT_NAME, url)

    async def _load(self, origin: str, hosts: Sequence[str]) -> tuple[_Rules, timedelta]:
        # RFC 9309: a 4xx means no rules, an unreachable file means no access
        try:
            response = await self._fetcher.get(f"{origin}/robots.txt", hosts, detect_blocks=False)
        except FetchError as error:
            logger.warning("robots_unreachable", origin=origin, error=str(error))
            return False, _UNREACHABLE_TTL
        if response.status == 200:
            parser = RobotFileParser()
            parser.parse(response.body.decode("utf-8", errors="replace").splitlines())
            return parser, self._ttl
        if 400 <= response.status < 500:
            return True, self._ttl
        logger.warning("robots_unreachable", origin=origin, status=response.status)
        return False, _UNREACHABLE_TTL
