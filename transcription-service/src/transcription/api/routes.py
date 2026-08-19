"""API routes for transcription service."""

import uuid
from typing import Annotated

from arq.connections import ArqRedis
from fastapi import APIRouter, Depends, HTTPException, UploadFile, status

from transcription.api.schemas import (
    HealthResponse,
    JobCreatedResponse,
    JobResultResponse,
    JobStatusResponse,
    TranscribeUrlRequest,
)
from transcription.config import Settings, get_settings
from transcription.models import JobStatus, TranscriptionJob
from transcription.storage.jobs import JobStorage
from transcription.storage.s3 import S3Storage
from transcription.worker.tasks import TRANSCRIBE_TASK_NAME

router = APIRouter()


# ============== Dependencies ==============


async def get_job_storage() -> JobStorage:
    """Get job storage instance."""
    # In production, this would be injected properly
    from transcription.main import get_redis_pool

    redis = await get_redis_pool()
    return JobStorage(redis)


async def get_s3_storage() -> S3Storage:
    """Get S3 storage instance."""
    settings = get_settings()
    return S3Storage(settings)


async def get_arq_redis() -> ArqRedis:
    """Get ARQ Redis connection for enqueuing jobs."""
    from transcription.main import get_redis_pool

    return await get_redis_pool()


# ============== Routes ==============


@router.get("/health", response_model=HealthResponse)
async def health_check(
    settings: Annotated[Settings, Depends(get_settings)],
) -> HealthResponse:
    """Health check endpoint."""
    import torch

    from transcription import __version__

    # Check Redis
    redis_connected = True
    try:
        redis = await get_arq_redis()
        await redis.ping()
    except Exception:
        redis_connected = False

    return HealthResponse(
        status="ok",
        version=__version__,
        redis_connected=redis_connected,
        gpu_available=torch.cuda.is_available(),
    )


@router.post(
    "/transcribe/url",
    response_model=JobCreatedResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def transcribe_url(
    request: TranscribeUrlRequest,
    job_storage: Annotated[JobStorage, Depends(get_job_storage)],
    arq: Annotated[ArqRedis, Depends(get_arq_redis)],
) -> JobCreatedResponse:
    """Start transcription from URL (YouTube, etc.)."""
    job_id = str(uuid.uuid4())

    job = TranscriptionJob(
        id=job_id,
        source_url=str(request.url),
        language=request.language,
        enable_diarization=request.enable_diarization,
    )

    await job_storage.save(job)
    await arq.enqueue_job(TRANSCRIBE_TASK_NAME, job_id)

    return JobCreatedResponse(
        job_id=job_id,
        status=JobStatus.PENDING,
        message="Transcription job created",
    )


@router.post(
    "/transcribe/file",
    response_model=JobCreatedResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def transcribe_file(
    file: UploadFile,
    job_storage: Annotated[JobStorage, Depends(get_job_storage)],
    s3: Annotated[S3Storage, Depends(get_s3_storage)],
    arq: Annotated[ArqRedis, Depends(get_arq_redis)],
    settings: Annotated[Settings, Depends(get_settings)],
    language: str | None = None,
    enable_diarization: bool = False,
) -> JobCreatedResponse:
    """Start transcription from uploaded file."""
    # Validate file size
    if file.size and file.size > settings.max_file_size_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File size exceeds {settings.max_file_size_mb}MB limit",
        )

    # Validate content type
    allowed_types = {"audio/", "video/"}
    content_type = file.content_type or ""
    if not any(content_type.startswith(t) for t in allowed_types):
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="File must be audio or video",
        )

    job_id = str(uuid.uuid4())

    # Upload to S3
    s3_key = f"uploads/{job_id}/{file.filename}"
    await s3.upload_file(file.file, s3_key, content_type)

    job = TranscriptionJob(
        id=job_id,
        source_file=s3_key,
        language=language,
        enable_diarization=enable_diarization,
    )

    await job_storage.save(job)
    await arq.enqueue_job(TRANSCRIBE_TASK_NAME, job_id)

    return JobCreatedResponse(
        job_id=job_id,
        status=JobStatus.PENDING,
        message="File uploaded, transcription job created",
    )


@router.get("/transcribe/{job_id}", response_model=JobStatusResponse)
async def get_job_status(
    job_id: str,
    job_storage: Annotated[JobStorage, Depends(get_job_storage)],
) -> JobStatusResponse:
    """Get transcription job status."""
    job = await job_storage.get(job_id)
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found",
        )

    return JobStatusResponse(
        job_id=job.id,
        status=job.status,
        progress=job.progress,
        status_message=job.status_message,
        created_at=job.created_at,
        started_at=job.started_at,
        completed_at=job.completed_at,
        error=job.error,
    )


@router.get("/transcribe/{job_id}/result", response_model=JobResultResponse)
async def get_job_result(
    job_id: str,
    job_storage: Annotated[JobStorage, Depends(get_job_storage)],
    s3: Annotated[S3Storage, Depends(get_s3_storage)],
) -> JobResultResponse:
    """Get transcription result."""
    job = await job_storage.get(job_id)
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found",
        )

    if job.status == JobStatus.FAILED:
        return JobResultResponse(
            job_id=job.id,
            status=job.status,
            error=job.error,
        )

    if job.status != JobStatus.COMPLETED:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Job is not completed yet. Status: {job.status}",
        )

    # Generate pre-signed URL for result file
    result_url = None
    if job.result_file:
        result_url = await s3.get_presigned_url(job.result_file)

    return JobResultResponse(
        job_id=job.id,
        status=job.status,
        result=job.result,
        result_url=result_url,
    )


@router.delete("/transcribe/{job_id}", status_code=status.HTTP_204_NO_CONTENT)
async def cancel_job(
    job_id: str,
    job_storage: Annotated[JobStorage, Depends(get_job_storage)],
) -> None:
    """Cancel a pending job."""
    job = await job_storage.get(job_id)
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found",
        )

    if job.is_terminal:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot cancel a completed or failed job",
        )

    # Mark as failed/cancelled
    job.status = JobStatus.FAILED
    job.error = "Cancelled by user"
    await job_storage.save(job)
