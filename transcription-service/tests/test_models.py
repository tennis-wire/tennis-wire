"""Tests for models and transcriber logic."""

from transcription.models import (
    JobStatus,
    TranscriptionJob,
    TranscriptionResult,
    TranscriptionSegment,
)


class TestTranscriptionJob:
    """Tests for TranscriptionJob model."""

    def test_job_creation(self) -> None:
        """Test creating a job."""
        job = TranscriptionJob(
            id="test-123",
            source_url="https://youtube.com/watch?v=test",
        )

        assert job.id == "test-123"
        assert job.status == JobStatus.PENDING
        assert job.progress == 0
        assert not job.is_terminal

    def test_job_is_terminal(self) -> None:
        """Test is_terminal property."""
        job = TranscriptionJob(id="test-123")

        job.status = JobStatus.PENDING
        assert not job.is_terminal

        job.status = JobStatus.PROCESSING
        assert not job.is_terminal

        job.status = JobStatus.COMPLETED
        assert job.is_terminal

        job.status = JobStatus.FAILED
        assert job.is_terminal


class TestTranscriptionResult:
    """Tests for TranscriptionResult model."""

    def test_from_whisperx(self) -> None:
        """Test creating result from WhisperX output."""
        whisperx_output = {
            "segments": [
                {"start": 0.0, "end": 2.5, "text": "Hello world"},
                {"start": 2.5, "end": 5.0, "text": "This is a test"},
            ]
        }

        result = TranscriptionResult.from_whisperx(whisperx_output, "en")

        assert result.language == "en"
        assert len(result.segments) == 2
        assert result.segments[0].text == "Hello world"
        assert result.text == "Hello world This is a test"
        assert result.duration == 5.0

    def test_from_whisperx_empty(self) -> None:
        """Test creating result from empty WhisperX output."""
        result = TranscriptionResult.from_whisperx({"segments": []}, "en")

        assert result.language == "en"
        assert len(result.segments) == 0
        assert result.text == ""
        assert result.duration == 0.0

    def test_from_whisperx_with_speaker(self) -> None:
        """Test creating result with speaker diarization."""
        whisperx_output = {
            "segments": [
                {"start": 0.0, "end": 2.5, "text": "Hello", "speaker": "SPEAKER_00"},
                {"start": 2.5, "end": 5.0, "text": "Hi there", "speaker": "SPEAKER_01"},
            ]
        }

        result = TranscriptionResult.from_whisperx(whisperx_output, "en")

        assert result.segments[0].speaker == "SPEAKER_00"
        assert result.segments[1].speaker == "SPEAKER_01"


class TestTranscriptionSegment:
    """Tests for TranscriptionSegment model."""

    def test_segment_creation(self) -> None:
        """Test creating a segment."""
        segment = TranscriptionSegment(
            start=0.0,
            end=2.5,
            text="Hello world",
        )

        assert segment.start == 0.0
        assert segment.end == 2.5
        assert segment.text == "Hello world"
        assert segment.speaker is None

    def test_segment_with_words(self) -> None:
        """Test segment with word-level timestamps."""
        segment = TranscriptionSegment(
            start=0.0,
            end=2.5,
            text="Hello world",
            words=[
                {"word": "Hello", "start": 0.0, "end": 1.0},
                {"word": "world", "start": 1.5, "end": 2.5},
            ],
        )

        assert segment.words is not None
        assert len(segment.words) == 2
