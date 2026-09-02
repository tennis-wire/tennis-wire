"""API routes for transcription service."""

import os
import re
import uuid
from pathlib import Path
from typing import IO, Annotated

from arq.connections import ArqRedis
from fastapi import APIRouter, Depends, HTTPException, UploadFile, status

from transcription.api.deps import get_arq_redis, get_job_storage, get_s3_storage
from transcription.api.schemas import (
    HealthResponse,
    JobCreatedResponse,
    JobResultResponse,
    JobStatusResponse,
    TranscribeUrlRequest,
)
from transcription.config import Settings, get_settings
from transcription.constants import TRANSCRIBE_TASK_NAME
from transcription.models import JobStatus, TranscriptionJob
from transcription.security import check_media_url_allowed
from transcription.storage.jobs import JobStorage
from transcription.storage.s3 import S3Storage

router = APIRouter()


def _gpu_available() -> bool:
    """Report GPU availability without requiring torch on the API process."""
    try:
        import torch
    except ImportError:
        return False
    return bool(torch.cuda.is_available())


# ============== Routes ==============


@router.get("/health", response_model=HealthResponse)
async def health_check(
    arq: Annotated[ArqRedis, Depends(get_arq_redis)],
) -> HealthResponse:
    """Health check endpoint."""
    from transcription import __version__

    # Check Redis
    redis_connected = True
    try:
        await arq.ping()
    except Exception:
        redis_connected = False

    return HealthResponse(
        status="ok",
        version=__version__,
        redis_connected=redis_connected,
        gpu_available=_gpu_available(),
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
    settings: Annotated[Settings, Depends(get_settings)],
) -> JobCreatedResponse:
    """Start transcription from URL (YouTube, etc.)."""
    try:
        check_media_url_allowed(str(request.url), settings.allowed_media_hosts)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc

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


def _measure(fileobj: IO[bytes]) -> int:
    """Return the exact size of an already-buffered upload.

    UploadFile.size comes from the multipart parser and can be None, in which
    case the previous check silently passed everything through. The body is
    fully spooled by the time the handler runs, so seeking to the end is exact
    and costs nothing.
    """
    fileobj.seek(0, os.SEEK_END)
    size = fileobj.tell()
    fileobj.seek(0)
    return size


def _safe_suffix(filename: str | None) -> str:
    """Derive a storage-safe extension from a client-supplied filename.

    The filename is attacker-controlled and used to be interpolated into the S3
    key as-is, so "../../results/<id>/transcript.json" addressed another job's
    output. Only a short alphanumeric extension survives.
    """
    suffix = Path(filename or "").suffix.lower()
    return suffix if re.fullmatch(r"\.[a-z0-9]{1,8}", suffix) else ""


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
    size = _measure(file.file)
    if size > settings.max_file_size_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_CONTENT_TOO_LARGE,
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
    s3_key = f"uploads/{job_id}/source{_safe_suffix(file.filename)}"
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
