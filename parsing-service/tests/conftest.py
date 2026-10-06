"""Shared fixtures: settings without .env, fake Redis, a profile factory, saved pages."""

import gzip
from collections.abc import AsyncIterator, Callable
from datetime import timedelta
from pathlib import Path
from typing import Any

import httpx
import pytest
from fakeredis import FakeAsyncRedis

from parsing.config import Settings
from parsing.pipeline import Deps, build_deps
from parsing.sources import SourceProfile

FIXTURES = Path(__file__).parent / "fixtures"

ProfileFactory = Callable[..., SourceProfile]


def fixture_bytes(name: str) -> bytes:
    data = (FIXTURES / name).read_bytes()
    return gzip.decompress(data) if name.endswith(".gz") else data


@pytest.fixture
def settings(tmp_path: Path) -> Settings:
    return Settings(
        _env_file=None,
        output_dir=tmp_path / "out",
        host_delay=timedelta(0),
    )


@pytest.fixture
async def redis() -> AsyncIterator[FakeAsyncRedis]:
    client = FakeAsyncRedis()
    yield client
    await client.aclose()


@pytest.fixture
async def client() -> AsyncIterator[httpx.AsyncClient]:
    async with httpx.AsyncClient(follow_redirects=False) as http:
        yield http


@pytest.fixture
def deps(settings: Settings, client: httpx.AsyncClient, redis: FakeAsyncRedis) -> Deps:
    return build_deps(settings, client, redis)


@pytest.fixture
def make_profile() -> ProfileFactory:
    def build(**overrides: Any) -> SourceProfile:
        fields: dict[str, Any] = {
            "key": "example",
            "name": "Example",
            "kind": "rss",
            "url": "https://news.example.com/feed",
            "hosts": ["example.com"],
            "language": "en",
            "interval": "PT1M",
        }
        fields.update(overrides)
        return SourceProfile.model_validate(fields)

    return build
