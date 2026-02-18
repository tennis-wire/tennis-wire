"""Transcription service FastAPI application."""

import logging
from contextlib import asynccontextmanager
from typing import AsyncIterator

import structlog
from arq.connections import ArqRedis, create_pool
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from transcription import __version__
from transcription.api.routes import router
from transcription.config import get_settings

# Configure structlog
structlog.configure(
    processors=[
        structlog.contextvars.merge_contextvars,
        structlog.processors.add_log_level,
        structlog.processors.StackInfoRenderer(),
        structlog.dev.set_exc_info,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.dev.ConsoleRenderer() if get_settings().is_development else structlog.processors.JSONRenderer(),
    ],
    wrapper_class=structlog.make_filtering_bound_logger(
        logging.getLevelName(get_settings().log_level)
    ),
    context_class=dict,
    logger_factory=structlog.PrintLoggerFactory(),
    cache_logger_on_first_use=True,
)

logger = structlog.get_logger()

# Global Redis pool
_redis_pool: ArqRedis | None = None


async def get_redis_pool() -> ArqRedis:
    """Get or create Redis connection pool."""
    global _redis_pool
    if _redis_pool is None:
        settings = get_settings()
        from arq.connections import RedisSettings
        _redis_pool = await create_pool(RedisSettings.from_dsn(str(settings.redis_url)))
    return _redis_pool


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Application lifespan manager."""
    settings = get_settings()
    logger.info(
        "Starting transcription service",
        version=__version__,
        env=settings.app_env,
    )

    # Initialize Redis pool
    await get_redis_pool()
    logger.info("Redis connected")

    yield

    # Cleanup
    global _redis_pool
    if _redis_pool:
        await _redis_pool.close()
        _redis_pool = None
    logger.info("Shutdown complete")


def create_app() -> FastAPI:
    """Create FastAPI application."""
    settings = get_settings()

    app = FastAPI(
        title="Transcription Service",
        description="Video/audio transcription service using WhisperX",
        version=__version__,
        docs_url="/docs" if settings.is_development else None,
        redoc_url="/redoc" if settings.is_development else None,
        lifespan=lifespan,
    )

    # CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"] if settings.is_development else [],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Routes
    app.include_router(router, prefix="/api", tags=["transcription"])

    return app


# Create app instance
app = create_app()


if __name__ == "__main__":
    import uvicorn

    settings = get_settings()
    uvicorn.run(
        "transcription.main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.is_development,
    )
