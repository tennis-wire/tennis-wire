import asyncio
from collections import defaultdict
from datetime import timedelta
from time import monotonic

import httpx
import pytest
import respx

from parsing.config import Settings
from parsing.fetch import (
    BlockedError,
    Fetcher,
    FetchError,
    HostNotAllowedError,
    HostThrottle,
    TooLargeError,
    TooManyRedirectsError,
)
from parsing.models import BlockKind

HOSTS = ["example.com"]


@pytest.fixture
def fetcher(settings: Settings, client: httpx.AsyncClient) -> Fetcher:
    return Fetcher(client, settings, HostThrottle(timedelta(0)))


async def test_plain_get(fetcher: Fetcher, respx_mock: respx.MockRouter) -> None:
    respx_mock.get("https://example.com/a").respond(
        200, content=b"hello", headers={"content-type": "text/html; charset=windows-1251"}
    )

    response = await fetcher.get("https://example.com/a", HOSTS)

    assert (response.status, response.body, response.charset) == (200, b"hello", "windows-1251")


async def test_headers_are_sent(fetcher: Fetcher, respx_mock: respx.MockRouter) -> None:
    route = respx_mock.get("https://example.com/feed").respond(304)

    response = await fetcher.get("https://example.com/feed", HOSTS, headers={"If-None-Match": "x"})

    assert response.status == 304
    assert route.calls.last.request.headers["if-none-match"] == "x"


async def test_redirect_within_hosts_is_followed(
    fetcher: Fetcher, respx_mock: respx.MockRouter
) -> None:
    respx_mock.get("http://example.com/a").respond(
        301, headers={"location": "https://www.example.com/a"}
    )
    respx_mock.get("https://www.example.com/a").respond(200, content=b"ok")

    response = await fetcher.get("http://example.com/a", HOSTS)

    assert (response.url, response.body) == ("https://www.example.com/a", b"ok")


async def test_relative_redirect(fetcher: Fetcher, respx_mock: respx.MockRouter) -> None:
    respx_mock.get("https://example.com/a").respond(302, headers={"location": "/b"})
    respx_mock.get("https://example.com/b").respond(200, content=b"b")

    assert (await fetcher.get("https://example.com/a", HOSTS)).body == b"b"


async def test_url_outside_hosts_is_not_fetched(
    fetcher: Fetcher, respx_mock: respx.MockRouter
) -> None:
    with pytest.raises(HostNotAllowedError):
        await fetcher.get("http://169.254.169.254/latest/meta-data", HOSTS)

    assert not respx_mock.calls


async def test_redirect_outside_hosts_is_not_followed(
    fetcher: Fetcher, respx_mock: respx.MockRouter
) -> None:
    respx_mock.get("https://example.com/a").respond(
        302, headers={"location": "http://127.0.0.1:6379/"}
    )

    with pytest.raises(HostNotAllowedError, match=r"127\.0\.0\.1"):
        await fetcher.get("https://example.com/a", HOSTS)

    assert len(respx_mock.calls) == 1


async def test_redirect_to_consent_page_is_a_block(
    fetcher: Fetcher, respx_mock: respx.MockRouter
) -> None:
    respx_mock.get("https://example.com/a").respond(
        302, headers={"location": "https://consent.portal.org/collect?return=x"}
    )

    with pytest.raises(BlockedError) as raised:
        await fetcher.get("https://example.com/a", HOSTS)

    assert raised.value.block.kind is BlockKind.CONSENT


async def test_redirect_loop_ends(fetcher: Fetcher, respx_mock: respx.MockRouter) -> None:
    respx_mock.get("https://example.com/a").respond(302, headers={"location": "/a"})

    with pytest.raises(TooManyRedirectsError):
        await fetcher.get("https://example.com/a", HOSTS)


async def test_not_modified_is_not_a_redirect(
    fetcher: Fetcher, respx_mock: respx.MockRouter
) -> None:
    respx_mock.get("https://example.com/feed").respond(304, headers={"etag": "x"})

    assert (await fetcher.get("https://example.com/feed", HOSTS)).status == 304


async def test_block_is_raised(fetcher: Fetcher, respx_mock: respx.MockRouter) -> None:
    respx_mock.get("https://example.com/a").respond(202, content=b"")

    with pytest.raises(BlockedError) as raised:
        await fetcher.get("https://example.com/a", HOSTS)

    assert raised.value.block.kind is BlockKind.CHALLENGE


async def test_block_detection_can_be_off(fetcher: Fetcher, respx_mock: respx.MockRouter) -> None:
    respx_mock.get("https://example.com/robots.txt").respond(403)

    assert (
        await fetcher.get("https://example.com/robots.txt", HOSTS, detect_blocks=False)
    ).status == 403


async def test_response_over_the_limit(
    settings: Settings, client: httpx.AsyncClient, respx_mock: respx.MockRouter
) -> None:
    fetcher = Fetcher(
        client, settings.model_copy(update={"max_response_bytes": 10}), HostThrottle(timedelta(0))
    )
    respx_mock.get("https://example.com/a").respond(200, content=b"x" * 11)

    with pytest.raises(TooLargeError):
        await fetcher.get("https://example.com/a", HOSTS)


async def test_network_error_is_a_fetch_error(
    fetcher: Fetcher, respx_mock: respx.MockRouter
) -> None:
    respx_mock.get("https://example.com/a").mock(side_effect=httpx.ConnectTimeout("slow"))

    with pytest.raises(FetchError, match="ConnectTimeout"):
        await fetcher.get("https://example.com/a", HOSTS)


async def test_throttle_spaces_requests_to_one_host() -> None:
    throttle = HostThrottle(timedelta(milliseconds=50))
    started: dict[str, list[float]] = defaultdict(list)

    async def request(host: str) -> None:
        async with throttle.slot(host):
            started[host].append(monotonic())

    began = monotonic()
    await asyncio.gather(request("a.com"), request("a.com"), request("b.com"))

    first, second = started["a.com"]
    assert second - first >= 0.045
    # Another host does not wait its turn
    assert started["b.com"][0] - began < 0.04
