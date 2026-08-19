"""Domain models for transcription service."""

from datetime import UTC, datetime
from enum import StrEnum
from typing import Any

from pydantic import BaseModel, Field


class JobStatus(StrEnum):
    """Status of a transcription job."""

    PENDING = "pending"
    DOWNLOADING = "downloading"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class TranscriptionSegment(BaseModel):
    """A segment of transcribed text with timing."""

    start: float
    end: float
    text: str
    speaker: str | None = None
    words: list[dict[str, Any]] | None = None  # Word-level timestamps


class TranscriptionResult(BaseModel):
    """Result of a transcription job."""

    segments: list[TranscriptionSegment]
    language: str
    duration: float  # Total duration in seconds
    text: str  # Full text without timestamps

    @classmethod
    def from_whisperx(cls, result: dict[str, Any], language: str) -> "TranscriptionResult":
        """Create from WhisperX output."""
        segments = [
            TranscriptionSegment(
                start=seg["start"],
                end=seg["end"],
                text=seg["text"].strip(),
                speaker=seg.get("speaker"),
                words=seg.get("words"),
            )
            for seg in result.get("segments", [])
        ]

        full_text = " ".join(seg.text for seg in segments)
        duration = segments[-1].end if segments else 0.0

        return cls(
            segments=segments,
            language=language,
            duration=duration,
            text=full_text,
        )


class TranscriptionJob(BaseModel):
    """A transcription job."""

    id: str = Field(..., description="Unique job ID")
    status: JobStatus = JobStatus.PENDING
    source_url: str | None = None  # YouTube URL or other
    source_file: str | None = None  # S3 key of uploaded file
    language: str | None = None  # Auto-detect if None
    enable_diarization: bool = False

    # Progress tracking
    progress: int = Field(default=0, ge=0, le=100)
    status_message: str | None = None

    # Result
    result: TranscriptionResult | None = None
    result_file: str | None = None  # S3 key of result JSON
    error: str | None = None

    # Timestamps
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    started_at: datetime | None = None
    completed_at: datetime | None = None

    @property
    def is_terminal(self) -> bool:
        """Check if job is in a terminal state."""
        return self.status in (JobStatus.COMPLETED, JobStatus.FAILED)
