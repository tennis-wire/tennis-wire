"""FastAPI dependency providers.

All external resources used by route handlers are provided here, so that the
route module never reaches into ``transcription.main`` and tests can replace
any resource via ``app.dependency_overrides``.
"""

from functools import lru_cache
from typing import Annotated

from arq.connections import ArqRedis
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import PyJWKClient

from transcription.auth import (
    AUTHOR,
    KeysUnavailableError,
    Principal,
    TokenRejectedError,
    TokenVerifier,
)
from transcription.config import Settings, get_settings
from transcription.storage.jobs import JobStorage
from transcription.storage.s3 import S3Storage

_bearer = HTTPBearer(auto_error=False)


def get_arq_redis(request: Request) -> ArqRedis:
    """ARQ Redis pool created in the application lifespan (see main.lifespan)."""
    redis: ArqRedis = request.app.state.redis
    return redis


def get_job_storage(redis: Annotated[ArqRedis, Depends(get_arq_redis)]) -> JobStorage:
    """Job storage backed by the shared Redis pool."""
    return JobStorage(redis)


def get_s3_storage(settings: Annotated[Settings, Depends(get_settings)]) -> S3Storage:
    """S3 storage client."""
    return S3Storage(settings)


@lru_cache
def _token_verifier(jwks_uri: str, issuer: str, audience: str) -> TokenVerifier:
    # The key set is cached for five minutes and refetched on an unknown kid, so a rotation
    # is picked up. cache_keys stays off: that cache never expires, and a key removed from
    # the realm would go on verifying.
    keys = PyJWKClient(jwks_uri, timeout=5)
    return TokenVerifier(keys, issuer, audience)


def get_token_verifier(settings: Annotated[Settings, Depends(get_settings)]) -> TokenVerifier:
    return _token_verifier(settings.jwks_uri, settings.keycloak_issuer_uri, settings.jwt_audience)


# Plain def on purpose: fetching the key set blocks, and FastAPI runs sync dependencies in
# its threadpool rather than on the event loop.
def get_principal(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
    verifier: Annotated[TokenVerifier, Depends(get_token_verifier)],
) -> Principal:
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        return verifier.verify(credentials.credentials)
    except TokenRejectedError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
            headers={"WWW-Authenticate": 'Bearer error="invalid_token"'},
        ) from exc
    except KeysUnavailableError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Cannot verify tokens right now",
        ) from exc


def require_author(principal: Annotated[Principal, Depends(get_principal)]) -> Principal:
    # 403 is final: the token is valid and a retry gets the same answer until the role changes.
    if AUTHOR not in principal.roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="The author role is required",
        )
    return principal
