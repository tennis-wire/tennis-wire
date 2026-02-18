"""API request and response schemas."""

from datetime import datetime

from pydantic import BaseModel, Field, HttpUrl

from transcription.models import JobStatus, TranscriptionResult


# ============== Requests ==============


class TranscribeUrlRequest(BaseModel):
    """Request to transcribe from URL (YouTube, etc.)."""

    url: HttpUrl = Field(..., description="URL to video (YouTube, direct link)")
    language: str | None = Field(None, description="Language code (auto-detect if not provided)")
    enable_diarization: bool = Field(False, description="Enable speaker diarization")


class TranscribeFileRequest(BaseModel):
    """Metadata for file upload transcription."""

    language: str | None = Field(None, description="Language code (auto-detect if not provided)")
    enable_diarization: bool = Field(False, description="Enable speaker diarization")


# ============== Responses ==============


class JobCreatedResponse(BaseModel):
    """Response when a job is created."""

    job_id: str
    status: JobStatus
    message: str


class JobStatusResponse(BaseModel):
    """Response with job status."""

    job_id: str
    status: JobStatus
    progress: int = Field(ge=0, le=100)
    status_message: str | None = None
    created_at: datetime
    started_at: datetime | None = None
    completed_at: datetime | None = None
    error: str | None = None


class JobResultResponse(BaseModel):
    """Response with job result."""

    job_id: str
    status: JobStatus
    result: TranscriptionResult | None = None
    result_url: str | None = None  # Pre-signed S3 URL
    error: str | None = None


class HealthResponse(BaseModel):
    """Health check response."""

    status: str = "ok"
    version: str
    redis_connected: bool
    gpu_available: bool
