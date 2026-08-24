"""ARQ worker tasks for transcription."""

import asyncio
import os
import tempfile
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, ClassVar

import structlog
from arq.connections import ArqRedis, RedisSettings
from arq.worker import func

from transcription.config import get_settings
from transcription.constants import TRANSCRIBE_TASK_NAME
from transcription.models import JobStatus
from transcription.storage.jobs import JobStorage
from transcription.storage.s3 import S3Storage
from transcription.worker.transcriber import MediaDownloader, Transcriber

logger = structlog.get_logger()


def _make_temp_path(suffix: str) -> Path:
    """Create an empty temp file and return its path."""
    fd, name = tempfile.mkstemp(suffix=suffix)
    os.close(fd)
    return Path(name)


def _write_temp_json(content: str) -> Path:
    """Write content to a temp .json file and return its path."""
    with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
        f.write(content)
        return Path(f.name)


async def transcribe(ctx: dict[str, Any], job_id: str) -> dict[str, Any]:
    """
    Main transcription task.

    Handles:
    1. Downloading media (from URL or S3)
    2. Running WhisperX transcription
    3. Saving results to S3
    4. Updating job status
    """
    settings = get_settings()
    redis: ArqRedis = ctx["redis"]
    job_storage = JobStorage(redis)
    s3 = S3Storage(settings)

    # Get job
    job = await job_storage.get(job_id)
    if job is None:
        logger.error("Job not found", job_id=job_id)
        return {"error": "Job not found"}

    # Check if cancelled
    if job.status == JobStatus.FAILED:
        logger.info("Job was cancelled", job_id=job_id)
        return {"status": "cancelled"}

    # Update status
    job.status = JobStatus.DOWNLOADING
    job.started_at = datetime.now(UTC)
    await job_storage.save(job)

    downloader = MediaDownloader()
    transcriber: Transcriber = ctx["transcriber"]
    audio_path: Path | None = None

    try:
        # Progress callback
        async def update_progress(progress: int, message: str) -> None:
            job.progress = progress
            job.status_message = message
            await job_storage.save(job)

        # Download or get from S3
        if job.source_url:
            audio_path = await downloader.download(job.source_url, on_progress=update_progress)
        elif job.source_file:
            await update_progress(5, "Downloading from storage...")
            audio_path = await asyncio.to_thread(_make_temp_path, ".wav")
            await s3.download_file(job.source_file, audio_path)
            await update_progress(20, "Download complete")
        else:
            raise ValueError("No source URL or file provided")

        # Update status to processing
        job.status = JobStatus.PROCESSING
        await job_storage.save(job)

        # Transcribe
        result = await transcriber.transcribe(
            audio_path,
            language=job.language,
            enable_diarization=job.enable_diarization,
            on_progress=update_progress,
        )

        # Save result to S3
        result_key = f"results/{job_id}/transcript.json"
        result_json = result.model_dump_json(indent=2)

        temp_path = await asyncio.to_thread(_write_temp_json, result_json)
        await s3.upload_from_path(temp_path, result_key)
        await asyncio.to_thread(temp_path.unlink)

        # Update job with result
        job.status = JobStatus.COMPLETED
        job.progress = 100
        job.status_message = "Transcription complete"
        job.result = result
        job.result_file = result_key
        job.completed_at = datetime.now(UTC)
        await job_storage.save(job)

        logger.info(
            "Transcription completed",
            job_id=job_id,
            duration=result.duration,
            segments=len(result.segments),
        )

        return {"status": "completed", "job_id": job_id}

    except Exception as e:
        logger.exception("Transcription failed", job_id=job_id)

        job.status = JobStatus.FAILED
        job.error = str(e)
        job.completed_at = datetime.now(UTC)
        await job_storage.save(job)

        return {"status": "failed", "error": str(e)}

    finally:
        # Cleanup
        await asyncio.to_thread(downloader.cleanup)
        if audio_path:
            await asyncio.to_thread(audio_path.unlink, missing_ok=True)


async def startup(ctx: dict[str, Any]) -> None:
    """Worker startup - load models."""
    logger.info("Worker starting up...")

    settings = get_settings()
    transcriber = Transcriber(settings)

    # Pre-load model on startup
    transcriber.load_model()

    ctx["transcriber"] = transcriber
    logger.info("Worker ready")


async def shutdown(ctx: dict[str, Any]) -> None:
    """Worker shutdown."""
    logger.info("Worker shutting down...")


class WorkerSettings:
    """ARQ worker settings."""

    functions: ClassVar = [func(transcribe, name=TRANSCRIBE_TASK_NAME)]
    on_startup = startup
    on_shutdown = shutdown

    # Redis connection - must be a class attribute, not a method
    redis_settings = RedisSettings.from_dsn(str(get_settings().redis_url))

    # Job settings
    max_jobs = 2
    job_timeout = 3600
    keep_result = 3600
    health_check_interval = 30
