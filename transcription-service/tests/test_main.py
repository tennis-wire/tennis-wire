"""Application wiring that depends on the environment."""

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from transcription.config import get_settings
from transcription.main import create_app


@pytest.fixture
def app_env(monkeypatch: pytest.MonkeyPatch) -> Iterator[pytest.MonkeyPatch]:
    # create_app reads the cached settings, not a dependency, so the cache has to go both ways.
    get_settings.cache_clear()
    yield monkeypatch
    get_settings.cache_clear()


@pytest.mark.parametrize("path", ["/openapi.json", "/docs", "/redoc"])
def test_api_description_is_absent_outside_development(
    app_env: pytest.MonkeyPatch, path: str
) -> None:
    app_env.setenv("APP_ENV", "production")

    assert TestClient(create_app()).get(path).status_code == 404


def test_api_description_is_served_in_development(app_env: pytest.MonkeyPatch) -> None:
    app_env.setenv("APP_ENV", "development")

    assert TestClient(create_app()).get("/openapi.json").status_code == 200
