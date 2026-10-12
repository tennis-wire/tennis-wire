import json
from collections.abc import AsyncIterator
from datetime import UTC, datetime, timedelta
from typing import Any

import httpx
import pytest
import respx
from fakeredis import FakeAsyncRedis
from structlog.testing import capture_logs

from parsing.aggregator import (
    AggregatorClient,
    AggregatorError,
    AggregatorSink,
    CatalogPublisher,
    ServiceToken,
    item_payload,
    make_aggregator_client,
)
from parsing.config import Settings
from parsing.health import HealthBook
from parsing.models import (
    Block,
    BlockKind,
    ExtractionStatus,
    Item,
    ItemChange,
    RunReport,
    RunStatus,
)
from parsing.pipeline import build_deps, run_source
from tests.conftest import ProfileFactory
from tests.test_pipeline import FEED, A, page, rss

AGGREGATOR = "http://aggregator.test"
TOKEN_URL = "http://keycloak.test/realms/tennis-wire/protocol/openid-connect/token"
NOW = datetime(2026, 10, 12, 12, 0, tzinfo=UTC)


@pytest.fixture
def agg_settings(settings: Settings) -> Settings:
    return settings.model_copy(
        update={
            "aggregator_url": AGGREGATOR,
            "keycloak_issuer_uri": "http://keycloak.test/realms/tennis-wire",
        }
    )


@pytest.fixture
async def agg_http(agg_settings: Settings) -> AsyncIterator[httpx.AsyncClient]:
    async with make_aggregator_client(agg_settings) as client:
        yield client


@pytest.fixture
def aggregator(agg_http: httpx.AsyncClient, agg_settings: Settings) -> AggregatorClient:
    return AggregatorClient(agg_http, ServiceToken(agg_http, agg_settings))


@pytest.fixture
def token_route(respx_mock: respx.MockRouter) -> respx.Route:
    return respx_mock.post(TOKEN_URL).respond(200, json={"access_token": "t1", "expires_in": 300})


def item(**overrides: Any) -> Item:
    fields: dict[str, Any] = {
        "source": "example",
        "external_id": A,
        "url": A,
        "title": "A",
        "lead": "Lead of A",
        "first_seen_at": NOW,
        "language": "en",
        "categories": ["ATP"],
        "extraction": ExtractionStatus.FAILED,
        "extraction_error": "page answered 503",
    }
    fields.update(overrides)
    return Item.model_validate(fields)


def created(url: str = A) -> httpx.Response:
    return httpx.Response(200, json={"results": [{"url": url, "outcome": "created"}]})


def sent(route: respx.Route, index: int = -1) -> Any:
    return json.loads(route.calls[index].request.content)


async def test_the_token_is_asked_for_once_and_kept(
    aggregator: AggregatorClient, token_route: respx.Route, respx_mock: respx.MockRouter
) -> None:
    items = respx_mock.post(f"{AGGREGATOR}/internal/items").mock(return_value=created())

    await aggregator.send_items([item_payload(item(), update=False)])
    await aggregator.send_items([item_payload(item(), update=False)])

    assert token_route.call_count == 1
    form = token_route.calls.last.request.content.decode()
    assert "grant_type=client_credentials" in form
    assert "client_id=parsing-service" in form
    assert items.calls.last.request.headers["authorization"] == "Bearer t1"


async def test_a_refused_token_is_asked_for_again_once(
    aggregator: AggregatorClient, respx_mock: respx.MockRouter
) -> None:
    tokens = respx_mock.post(TOKEN_URL).mock(
        side_effect=[
            httpx.Response(200, json={"access_token": "old", "expires_in": 300}),
            httpx.Response(200, json={"access_token": "new", "expires_in": 300}),
        ]
    )
    items = respx_mock.post(f"{AGGREGATOR}/internal/items").mock(
        side_effect=[httpx.Response(401), created()]
    )

    await aggregator.send_items([item_payload(item(), update=False)])

    assert tokens.call_count == 2
    assert items.calls.last.request.headers["authorization"] == "Bearer new"


async def test_a_token_refused_twice_is_an_error(
    aggregator: AggregatorClient, token_route: respx.Route, respx_mock: respx.MockRouter
) -> None:
    respx_mock.post(f"{AGGREGATOR}/internal/items").respond(401)

    with pytest.raises(AggregatorError, match="items answered 401"):
        await aggregator.send_items([])


async def test_keycloak_not_answering_is_an_error(
    aggregator: AggregatorClient, respx_mock: respx.MockRouter
) -> None:
    respx_mock.post(TOKEN_URL).mock(side_effect=httpx.ConnectError("refused"))

    with pytest.raises(AggregatorError, match="token"):
        await aggregator.send_items([])


def test_the_payload_is_cut_to_the_aggregators_limits() -> None:
    long = item(
        text="x" * 300_000,
        title="t" * 2000,
        categories=[f"c{i}" for i in range(80)],
        image_url="https://example.com/" + "i" * 3000,
        extraction=ExtractionStatus.OK,
        extraction_error=None,
        published_at=NOW,
    )

    payload = item_payload(long, update=True)

    assert payload["change"] == "update"
    assert len(payload["text"]) == 200_000
    assert len(payload["title"]) == 1000
    assert len(payload["categories"]) == 50
    assert payload["imageUrl"] is None
    assert payload["extraction"] == "ok"
    assert payload["publishedAt"] == "2026-10-12T12:00:00+00:00"
    assert payload["externalId"] == A


async def test_a_rejected_item_is_logged_not_retried(
    aggregator: AggregatorClient, token_route: respx.Route, respx_mock: respx.MockRouter
) -> None:
    respx_mock.post(f"{AGGREGATOR}/internal/items").respond(
        200, json={"results": [{"url": A, "outcome": "rejected", "reason": "unknown source"}]}
    )

    with capture_logs() as logs:
        await AggregatorSink(aggregator).item(item(), None)

    assert [(log["event"], log["reason"]) for log in logs] == [("item_rejected", "unknown source")]


async def test_an_aggregator_that_does_not_answer_fails_the_send(
    aggregator: AggregatorClient, token_route: respx.Route, respx_mock: respx.MockRouter
) -> None:
    respx_mock.post(f"{AGGREGATOR}/internal/items").respond(503)

    with pytest.raises(AggregatorError, match="503"):
        await AggregatorSink(aggregator).item(item(), None)


async def test_a_changed_title_goes_as_an_update(
    aggregator: AggregatorClient, token_route: respx.Route, respx_mock: respx.MockRouter
) -> None:
    route = respx_mock.post(f"{AGGREGATOR}/internal/items").mock(return_value=created())
    change = ItemChange(
        source="example",
        url=A,
        seen_at=NOW,
        title_before="A",
        title="A, corrected",
        published_before=None,
        published=NOW,
    )

    sink = AggregatorSink(aggregator)
    await sink.change(change)
    await sink.run(RunReport(source="example", started_at=NOW))

    assert sent(route)["items"] == [
        {
            "change": "update",
            "url": A,
            "title": "A, corrected",
            "publishedAt": "2026-10-12T12:00:00+00:00",
        }
    ]
    # Run reports stay in the collector's log
    assert route.call_count == 1


async def test_the_catalog_and_health_follow_the_sources(
    aggregator: AggregatorClient,
    agg_settings: Settings,
    redis: FakeAsyncRedis,
    make_profile: ProfileFactory,
    token_route: respx.Route,
    respx_mock: respx.MockRouter,
) -> None:
    sources_route = respx_mock.put(f"{AGGREGATOR}/internal/sources").respond(204)
    health_route = respx_mock.put(
        url__regex=rf"{AGGREGATOR}/internal/sources/[^/]+/health"
    ).respond(204)
    book = HealthBook(redis, agg_settings)
    publisher = CatalogPublisher(aggregator, agg_settings)
    profiles = [
        make_profile(key="one", name="One", url="https://news.example.com/feed"),
        make_profile(key="off", enabled=False),
    ]

    await publisher.publish(profiles, book, NOW)
    await publisher.publish(profiles, book, NOW)

    assert sent(sources_route) == {
        "sources": [
            {"key": "one", "name": "One", "language": "en", "siteUrl": "https://news.example.com/"}
        ]
    }
    assert sources_route.call_count == 1
    # Nothing changed in between: one snapshot
    assert health_route.call_count == 1
    assert sent(health_route)["problems"] == []

    # A block for over an hour turns into a problem: a new snapshot at once
    block = Block(kind=BlockKind.CHALLENGE, http_status=403, url="https://news.example.com/feed")
    blocked_at = NOW - timedelta(hours=2)
    await book.record(
        RunReport(
            source="one",
            started_at=blocked_at,
            finished_at=blocked_at,
            status=RunStatus.BLOCKED,
            block=block,
        )
    )
    await publisher.publish(profiles, book, NOW)

    assert health_route.call_count == 2
    snapshot = sent(health_route)
    assert [problem["kind"] for problem in snapshot["problems"]] == ["blocked"]
    assert snapshot["blockKind"] == "challenge"
    assert snapshot["failuresInRow"] == 1


async def test_a_source_the_aggregator_does_not_know_sends_the_list_again(
    aggregator: AggregatorClient,
    agg_settings: Settings,
    redis: FakeAsyncRedis,
    make_profile: ProfileFactory,
    token_route: respx.Route,
    respx_mock: respx.MockRouter,
) -> None:
    sources_route = respx_mock.put(f"{AGGREGATOR}/internal/sources").respond(204)
    respx_mock.put(f"{AGGREGATOR}/internal/sources/example/health").mock(
        side_effect=[httpx.Response(404), httpx.Response(204)]
    )
    publisher = CatalogPublisher(aggregator, agg_settings)
    book = HealthBook(redis, agg_settings)

    await publisher.publish([make_profile()], book, NOW)
    await publisher.publish([make_profile()], book, NOW)

    assert sources_route.call_count == 2


async def test_an_aggregator_away_does_not_stop_the_tick(
    aggregator: AggregatorClient,
    agg_settings: Settings,
    redis: FakeAsyncRedis,
    make_profile: ProfileFactory,
    token_route: respx.Route,
    respx_mock: respx.MockRouter,
) -> None:
    respx_mock.put(f"{AGGREGATOR}/internal/sources").mock(side_effect=httpx.ConnectError("refused"))

    with capture_logs() as logs:
        await CatalogPublisher(aggregator, agg_settings).publish(
            [make_profile()], HealthBook(redis, agg_settings), NOW
        )

    assert [log["event"] for log in logs] == ["catalog_not_sent"]


async def test_nothing_is_marked_seen_that_did_not_arrive(
    agg_settings: Settings,
    client: httpx.AsyncClient,
    redis: FakeAsyncRedis,
    aggregator: AggregatorClient,
    make_profile: ProfileFactory,
    token_route: respx.Route,
    respx_mock: respx.MockRouter,
) -> None:
    respx_mock.get("https://news.example.com/robots.txt").respond(404)
    respx_mock.get(FEED).respond(200, content=rss(("A", A)))
    respx_mock.get(A).respond(200, content=page())
    items = respx_mock.post(f"{AGGREGATOR}/internal/items").mock(
        side_effect=[httpx.Response(503), created()]
    )
    deps = build_deps(agg_settings, client, redis, AggregatorSink(aggregator))
    profile = make_profile(url=FEED)

    down = await run_source(profile, deps)
    up = await run_source(profile, deps)

    assert down.status == RunStatus.FAILED
    assert (up.status, up.new) == (RunStatus.OK, 1)
    assert sent(items)["items"][0]["change"] == "new"
    assert await deps.state.seen("example", A) is not None


async def test_a_retry_updates_the_item_under_the_address_it_was_sent_with(
    agg_settings: Settings,
    client: httpx.AsyncClient,
    redis: FakeAsyncRedis,
    aggregator: AggregatorClient,
    make_profile: ProfileFactory,
    token_route: respx.Route,
    respx_mock: respx.MockRouter,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    clock = {"now": NOW}
    monkeypatch.setattr("parsing.pipeline._now", lambda: clock["now"])
    respx_mock.get("https://news.example.com/robots.txt").respond(404)
    respx_mock.get(FEED).respond(200, content=rss(("A", A)))
    # The page names another canonical address once it answers
    respx_mock.get(A).mock(
        side_effect=[
            httpx.Response(503),
            httpx.Response(200, content=page(canonical="https://news.example.com/tennis/a-final")),
        ]
    )
    items = respx_mock.post(f"{AGGREGATOR}/internal/items").mock(return_value=created())
    deps = build_deps(agg_settings, client, redis, AggregatorSink(aggregator))
    profile = make_profile(url=FEED)

    await run_source(profile, deps)
    clock["now"] = NOW + timedelta(minutes=6)
    report = await run_source(profile, deps)

    assert report.recovered == 1
    update = sent(items)["items"][0]
    assert (update["change"], update["url"], update["extraction"]) == ("update", A, "ok")
    assert update["text"]
