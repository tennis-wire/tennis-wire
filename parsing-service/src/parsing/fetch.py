"""HTTP for the collector: the host allowlist on every hop, size limit, one request per host."""

import asyncio
import re
from collections import defaultdict
from collections.abc import AsyncIterator, Mapping, Sequence
from contextlib import asynccontextmanager
from dataclasses import dataclass
from datetime import timedelta
from time import monotonic
from urllib.parse import urljoin

import httpx

from parsing.blocks import detect_block, is_consent_redirect
from parsing.config import Settings
from parsing.models import Block, BlockKind
from parsing.urls import host_allowed, host_of

# Not httpx's is_redirect: it is true for a 304 as well
_REDIRECTS = frozenset({301, 302, 303, 307, 308})
_CHARSET = re.compile(r"charset=[\"']?([\w.:-]+)", re.IGNORECASE)


class FetchError(Exception):
    pass


class HostNotAllowedError(FetchError):
    pass


class TooLargeError(FetchError):
    pass


class TooManyRedirectsError(FetchError):
    pass


class BlockedError(FetchError):
    def __init__(self, block: Block) -> None:
        super().__init__(f"{block.kind} ({block.http_status}) at {block.url}")
        self.block = block


@dataclass(frozen=True)
class Response:
    url: str
    status: int
    headers: httpx.Headers
    body: bytes

    @property
    def charset(self) -> str | None:
        match = _CHARSET.search(self.headers.get("content-type", ""))
        return match.group(1) if match else None


class HostThrottle:
    """Requests to one host go one at a time and at least `delay` apart."""

    def __init__(self, delay: timedelta) -> None:
        self._delay = delay.total_seconds()
        self._locks: defaultdict[str, asyncio.Lock] = defaultdict(asyncio.Lock)
        self._last: dict[str, float] = {}

    @asynccontextmanager
    async def slot(self, host: str) -> AsyncIterator[None]:
        async with self._locks[host]:
            last = self._last.get(host)
            if last is not None:
                wait = last + self._delay - monotonic()
                if wait > 0:
                    await asyncio.sleep(wait)
            try:
                yield
            finally:
                self._last[host] = monotonic()


def make_client(settings: Settings) -> httpx.AsyncClient:
    return httpx.AsyncClient(
        headers={"User-Agent": settings.user_agent},
        timeout=httpx.Timeout(
            settings.read_timeout.total_seconds(),
            connect=settings.connect_timeout.total_seconds(),
        ),
        # Redirects are followed by hand: every hop is checked against the source's hosts
        follow_redirects=False,
    )


class Fetcher:
    def __init__(
        self, client: httpx.AsyncClient, settings: Settings, throttle: HostThrottle
    ) -> None:
        self._client = client
        self._settings = settings
        self._throttle = throttle

    async def get(
        self,
        url: str,
        hosts: Sequence[str],
        headers: Mapping[str, str] | None = None,
        detect_blocks: bool = True,
    ) -> Response:
        """GET within the source's hosts.

        Raises HostNotAllowedError for a URL or a redirect outside them, BlockedError for a
        refusal (unless detect_blocks is off), TooLargeError past max_response_bytes.
        """
        current = url
        for _ in range(self._settings.max_redirects + 1):
            if not host_allowed(current, hosts):
                raise HostNotAllowedError(current)
            try:
                async with (
                    self._throttle.slot(host_of(current)),
                    self._client.stream("GET", current, headers=headers) as response,
                ):
                    if response.status_code in _REDIRECTS and "location" in response.headers:
                        status = response.status_code
                        target = urljoin(current, response.headers["location"])
                    else:
                        result = Response(
                            url=str(response.url),
                            status=response.status_code,
                            headers=response.headers,
                            body=await self._read(response),
                        )
                        target = None
            except httpx.HTTPError as error:
                raise FetchError(f"{type(error).__name__} at {current}: {error}") from error
            if target is None:
                break
            if not host_allowed(target, hosts) and is_consent_redirect(target):
                raise BlockedError(Block(kind=BlockKind.CONSENT, http_status=status, url=target))
            current = target
        else:
            raise TooManyRedirectsError(url)

        if detect_blocks:
            block = detect_block(result.status, result.headers, result.body, result.url)
            if block is not None:
                raise BlockedError(block)
        return result

    async def _read(self, response: httpx.Response) -> bytes:
        # Counted after decompression: a small gzip can unpack into gigabytes
        limit = self._settings.max_response_bytes
        chunks: list[bytes] = []
        size = 0
        async for chunk in response.aiter_bytes():
            size += len(chunk)
            if size > limit:
                raise TooLargeError(f"{response.url} is over {limit} bytes")
            chunks.append(chunk)
        return b"".join(chunks)
