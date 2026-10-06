from datetime import timedelta

import httpx
import pytest
import respx

from parsing.config import Settings
from parsing.fetch import Fetcher, HostThrottle
from parsing.robots import Robots

HOSTS = ["example.com"]


@pytest.fixture
def robots(settings: Settings, client: httpx.AsyncClient) -> Robots:
    return Robots(Fetcher(client, settings, HostThrottle(timedelta(0))), timedelta(hours=1))


async def test_rules_for_everyone_and_for_us(robots: Robots, respx_mock: respx.MockRouter) -> None:
    respx_mock.get("https://example.com/robots.txt").respond(
        200,
        text=(
            "User-agent: *\nDisallow: /search/\n\nUser-agent: TennisWireBot\nDisallow: /private/\n"
        ),
    )

    assert await robots.allowed("https://example.com/tennis/a", HOSTS)
    assert not await robots.allowed("https://example.com/private/a", HOSTS)
    # Our own group replaces the * group
    assert await robots.allowed("https://example.com/search/a", HOSTS)


async def test_robots_txt_is_read_once_per_origin(
    robots: Robots, respx_mock: respx.MockRouter
) -> None:
    route = respx_mock.get("https://example.com/robots.txt").respond(200, text="")

    await robots.allowed("https://example.com/a", HOSTS)
    await robots.allowed("https://example.com/b", HOSTS)

    assert route.call_count == 1


async def test_missing_robots_txt_allows_everything(
    robots: Robots, respx_mock: respx.MockRouter
) -> None:
    respx_mock.get("https://example.com/robots.txt").respond(404)

    assert await robots.allowed("https://example.com/a", HOSTS)


async def test_forbidden_robots_txt_allows_everything(
    robots: Robots, respx_mock: respx.MockRouter
) -> None:
    # RFC 9309: any 4xx; a site that blocks us shows it on the page itself
    respx_mock.get("https://example.com/robots.txt").respond(403)

    assert await robots.allowed("https://example.com/a", HOSTS)


async def test_unreachable_robots_txt_allows_nothing(
    robots: Robots, respx_mock: respx.MockRouter
) -> None:
    respx_mock.get("https://example.com/robots.txt").respond(503)
    respx_mock.get("https://www.example.com/robots.txt").mock(
        side_effect=httpx.ConnectError("refused")
    )

    assert not await robots.allowed("https://example.com/a", HOSTS)
    assert not await robots.allowed("https://www.example.com/a", HOSTS)
