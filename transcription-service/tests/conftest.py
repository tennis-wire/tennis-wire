"""Pytest configuration and fixtures."""

import time
from collections.abc import Callable, Iterator
from typing import Any
from unittest.mock import AsyncMock, MagicMock

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi import FastAPI
from fastapi.testclient import TestClient
from jwt import PyJWK, PyJWKClientError
from jwt.algorithms import RSAAlgorithm

from transcription.api.deps import (
    get_arq_redis,
    get_job_storage,
    get_s3_storage,
    get_token_verifier,
)
from transcription.auth import TokenVerifier
from transcription.config import Settings, get_settings
from transcription.main import create_app
from transcription.models import TranscriptionJob

KID = "test-key"
AUTHOR_SUB = "5f0c7a52-author"

TokenFactory = Callable[..., str]


class FakeSigningKeys:
    """The realm's key set, reduced to the one test key."""

    def __init__(self, public_key: rsa.RSAPublicKey) -> None:
        jwk = RSAAlgorithm.to_jwk(public_key, as_dict=True)
        self.key = PyJWK({**jwk, "kid": KID, "alg": "RS256", "use": "sig"})

    def get_signing_key_from_jwt(self, token: str) -> PyJWK:
        if jwt.get_unverified_header(token).get("kid") != KID:
            raise PyJWKClientError("Unable to find a signing key that matches")
        return self.key


@pytest.fixture(scope="session")
def signing_key() -> rsa.RSAPrivateKey:
    return rsa.generate_private_key(public_exponent=65537, key_size=2048)


@pytest.fixture
def token_verifier(signing_key: rsa.RSAPrivateKey, settings: Settings) -> TokenVerifier:
    keys = FakeSigningKeys(signing_key.public_key())
    return TokenVerifier(keys, settings.keycloak_issuer_uri, settings.jwt_audience)


@pytest.fixture
def make_token(signing_key: rsa.RSAPrivateKey, settings: Settings) -> TokenFactory:
    """A token shaped like Keycloak's; keyword arguments replace claims, None drops one."""

    def build(key: Any = None, kid: str = KID, algorithm: str = "RS256", **overrides: Any) -> str:
        now = int(time.time())
        claims: dict[str, Any] = {
            "iss": settings.keycloak_issuer_uri,
            "aud": [settings.jwt_audience, "account"],
            "sub": AUTHOR_SUB,
            "iat": now,
            "exp": now + 300,
            "azp": "editorial-ui",
            "preferred_username": "dev",
            "realm_access": {"roles": ["author"]},
        }
        claims.update(overrides)
        claims = {name: value for name, value in claims.items() if value is not None}
        return jwt.encode(
            claims,
            signing_key if key is None else key,
            algorithm=algorithm,
            headers={"kid": kid},
        )

    return build


class FakeJobStorage:
    """In-memory JobStorage replacement for tests."""

    def __init__(self) -> None:
        self.jobs: dict[str, TranscriptionJob] = {}

    async def save(self, job: TranscriptionJob) -> None:
        self.jobs[job.id] = job

    async def get(self, job_id: str) -> TranscriptionJob | None:
        return self.jobs.get(job_id)

    async def delete(self, job_id: str) -> None:
        self.jobs.pop(job_id, None)


@pytest.fixture
def job_storage() -> FakeJobStorage:
    """In-memory job storage."""
    return FakeJobStorage()


@pytest.fixture
def mock_arq() -> AsyncMock:
    """Mock ARQ Redis connection."""
    mock = AsyncMock()
    mock.enqueue_job = AsyncMock()
    mock.ping = AsyncMock()
    return mock


@pytest.fixture
def mock_s3() -> MagicMock:
    """Mock S3 storage."""
    mock = MagicMock()
    mock.upload_file = AsyncMock(return_value="uploads/key")
    mock.download_file = AsyncMock()
    mock.get_presigned_url = AsyncMock(return_value="https://s3.example.com/file")
    return mock


@pytest.fixture
def app(
    job_storage: FakeJobStorage,
    mock_arq: AsyncMock,
    mock_s3: MagicMock,
    settings: Settings,
    token_verifier: TokenVerifier,
) -> Iterator[FastAPI]:
    """Test application with all external dependencies overridden."""
    application = create_app()
    application.dependency_overrides[get_token_verifier] = lambda: token_verifier
    application.dependency_overrides[get_job_storage] = lambda: job_storage
    application.dependency_overrides[get_arq_redis] = lambda: mock_arq
    application.dependency_overrides[get_s3_storage] = lambda: mock_s3
    application.dependency_overrides[get_settings] = lambda: settings
    yield application
    application.dependency_overrides.clear()


@pytest.fixture
def client(app: FastAPI, make_token: TokenFactory) -> TestClient:
    """Test client signed in as an author."""
    return TestClient(app, headers={"Authorization": f"Bearer {make_token()}"})


@pytest.fixture
def anonymous_client(app: FastAPI) -> TestClient:
    """Test client without a token."""
    return TestClient(app)


@pytest.fixture
def mock_job() -> TranscriptionJob:
    """A sample transcription job."""
    return TranscriptionJob(
        id="test-job-123",
        source_url="https://youtube.com/watch?v=test",
        language="en",
    )


@pytest.fixture
def settings() -> Settings:
    """Settings with the developer's local .env ignored.

    The API builds Settings at request time, so without this the outcome of a
    test depends on whatever the machine happens to have in .env.
    """
    return Settings(_env_file=None)
