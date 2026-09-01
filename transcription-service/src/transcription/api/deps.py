"""FastAPI dependency providers.

All external resources used by route handlers are provided here, so that the
route module never reaches into ``transcription.main`` and tests can replace
any resource via ``app.dependency_overrides``.
"""

from typing import Annotated

from arq.connections import ArqRedis
from fastapi import Depends, Request

from transcription.config import Settings, get_settings
from transcription.storage.jobs import JobStorage
from transcription.storage.s3 import S3Storage


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
