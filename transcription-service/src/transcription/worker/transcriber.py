"""WhisperX transcriber implementation."""

import asyncio
import tempfile
from pathlib import Path
from typing import Any
import whisperx

import structlog

from transcription.config import Settings
from transcription.models import TranscriptionResult, TranscriptionSegment

logger = structlog.get_logger()


class MockTranscriber:
    """Mock transcriber for development/testing without WhisperX."""

    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    def load_model(self) -> None:
        """No-op for mock."""
        logger.info("Mock transcriber ready (no actual model loaded)")

    async def transcribe(
        self,
        audio_path: Path,
        *,
        language: str | None = None,
        enable_diarization: bool = False,
        on_progress: Any | None = None,
    ) -> TranscriptionResult:
        """Return fake transcription result."""
        if on_progress:
            await on_progress(10, "Mock: Starting...")
            await asyncio.sleep(1)
            await on_progress(50, "Mock: Processing...")
            await asyncio.sleep(1)
            await on_progress(90, "Mock: Finishing...")

        return TranscriptionResult(
            segments=[
                TranscriptionSegment(
                    start=0.0,
                    end=2.5,
                    text="This is a mock transcription.",
                    speaker="SPEAKER_00" if enable_diarization else None,
                ),
                TranscriptionSegment(
                    start=2.5,
                    end=5.0,
                    text="WhisperX is not loaded in mock mode.",
                    speaker="SPEAKER_00" if enable_diarization else None,
                ),
                TranscriptionSegment(
                    start=5.0,
                    end=8.0,
                    text=f"Audio file: {audio_path.name}",
                    speaker="SPEAKER_01" if enable_diarization else None,
                ),
            ],
            language=language or "en",
            duration=8.0,
            text="This is a mock transcription. WhisperX is not loaded in mock mode. Audio file: " + audio_path.name,
        )


class FasterWhisperTranscriber:
    """
    Simpler transcriber using faster-whisper directly.

    No speaker diarization, but works without pyannote compatibility issues.
    Good for Mac M1/M2 and simpler deployments.
    """

    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self._model: Any | None = None

    @property
    def device(self) -> str:
        """Get compute device."""
        if self.settings.whisper_device == "cuda":
            import torch
            if torch.cuda.is_available():
                return "cuda"
        return "cpu"

    @property
    def compute_type(self) -> str:
        """Get compute type based on device."""
        if self.device == "cpu":
            return "float32"
        return self.settings.whisper_compute_type

    def load_model(self) -> None:
        """Load faster-whisper model."""
        from faster_whisper import WhisperModel

        if self._model is not None:
            return

        logger.info(
            "Loading faster-whisper model",
            model=self.settings.whisper_model,
            device=self.device,
            compute_type=self.compute_type,
        )

        self._model = WhisperModel(
            self.settings.whisper_model,
            device=self.device,
            compute_type=self.compute_type,
        )

    async def transcribe(
        self,
        audio_path: Path,
        *,
        language: str | None = None,
        enable_diarization: bool = False,
        on_progress: Any | None = None,
    ) -> TranscriptionResult:
        """Transcribe audio file using faster-whisper."""
        if enable_diarization:
            logger.warning("Diarization not supported in FasterWhisperTranscriber, ignoring")

        if on_progress:
            await on_progress(10, "Loading audio...")

        loop = asyncio.get_event_loop()

        # Run transcription in thread pool (it's CPU-bound)
        def do_transcribe() -> tuple[list[Any], Any]:
            segments, info = self._model.transcribe(
                str(audio_path),
                language=language,
                beam_size=5,
                word_timestamps=True,
            )
            return list(segments), info

        if on_progress:
            await on_progress(20, "Transcribing...")

        segments_list, info = await loop.run_in_executor(None, do_transcribe)

        if on_progress:
            await on_progress(90, "Processing results...")

        # Convert to our format
        result_segments = []
        for seg in segments_list:
            words = None
            if hasattr(seg, 'words') and seg.words:
                words = [
                    {"word": w.word, "start": w.start, "end": w.end}
                    for w in seg.words
                ]

            result_segments.append(TranscriptionSegment(
                start=seg.start,
                end=seg.end,
                text=seg.text.strip(),
                speaker=None,
                words=words,
            ))

        full_text = " ".join(seg.text for seg in result_segments)
        duration = result_segments[-1].end if result_segments else 0.0
        detected_language = info.language if hasattr(info, 'language') else (language or "en")

        if on_progress:
            await on_progress(100, "Complete")

        return TranscriptionResult(
            segments=result_segments,
            language=detected_language,
            duration=duration,
            text=full_text,
        )


class Transcriber:
    """WhisperX-based audio/video transcriber (full features, may have compatibility issues)."""

    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self._model: Any | None = None
        self._align_model: Any | None = None
        self._diarize_pipeline: Any | None = None

    @property
    def device(self) -> str:
        """Get compute device."""
        import torch
        if self.settings.whisper_device == "cuda" and torch.cuda.is_available():
            return "cuda"
        return "cpu"

    @property
    def compute_type(self) -> str:
        """Get compute type based on device."""
        if self.device == "cpu":
            return "float32"  # CPU doesn't support float16
        return self.settings.whisper_compute_type

    def load_model(self) -> None:
        """Load WhisperX model (lazy loading)."""
        import whisperx

        if self._model is not None:
            return

        logger.info(
            "Loading WhisperX model",
            model=self.settings.whisper_model,
            device=self.device,
            compute_type=self.compute_type,
        )

        self._model = whisperx.load_model(
            self.settings.whisper_model,
            self.device,
            compute_type=self.compute_type,
        )

    def _load_align_model(self, language: str) -> None:
        """Load alignment model for word-level timestamps."""
        if self._align_model is not None:
            return

        logger.info("Loading alignment model", language=language)
        model, metadata = whisperx.load_align_model(
            language_code=language,
            device=self.device,
        )
        self._align_model = model
        self._align_metadata = metadata

    def _load_diarize_pipeline(self) -> None:
        """Load speaker diarization pipeline."""
        if self._diarize_pipeline is not None:
            return

        if not self.settings.hf_token:
            raise ValueError("HF_TOKEN required for speaker diarization")

        logger.info("Loading diarization pipeline")
        self._diarize_pipeline = whisperx.DiarizationPipeline(
            use_auth_token=self.settings.hf_token,
            device=self.device,
        )

    async def transcribe(
        self,
        audio_path: Path,
        *,
        language: str | None = None,
        enable_diarization: bool = False,
        on_progress: Any | None = None,
    ) -> TranscriptionResult:
        """
        Transcribe audio file.

        Args:
            audio_path: Path to audio/video file
            language: Language code (auto-detect if None)
            enable_diarization: Enable speaker diarization
            on_progress: Callback for progress updates (0-100)

        Returns:
            TranscriptionResult with segments and full text
        """

        loop = asyncio.get_event_loop()
        self.load_model()

        # Progress: 0-30% - transcription
        if on_progress:
            await on_progress(5, "Loading audio...")

        logger.info("Starting transcription", path=str(audio_path))

        # Load audio (blocking -> run in executor)
        audio = await loop.run_in_executor(
            None, lambda: whisperx.load_audio(str(audio_path))
        )

        if on_progress:
            await on_progress(10, "Transcribing...")

        # Transcribe (blocking -> run in executor)
        def do_transcribe() -> dict[str, Any]:
            return self._model.transcribe(
                audio,
                batch_size=16,
                language=language,
            )

        result = await loop.run_in_executor(None, do_transcribe)

        detected_language = result.get("language", language or "en")
        logger.info("Transcription complete", language=detected_language)

        if on_progress:
            await on_progress(40, "Aligning words...")

        # Align for word-level timestamps (blocking -> run in executor)
        try:
            self._load_align_model(detected_language)

            def do_align() -> dict[str, Any]:
                return whisperx.align(
                    result["segments"],
                    self._align_model,
                    self._align_metadata,
                    audio,
                    self.device,
                    return_char_alignments=False,
                )

            result = await loop.run_in_executor(None, do_align)
        except Exception as e:
            logger.warning("Alignment failed, using segment-level timestamps", error=str(e))

        if on_progress:
            await on_progress(70, "Processing...")

        # Speaker diarization
        if enable_diarization:
            if on_progress:
                await on_progress(75, "Identifying speakers...")

            try:
                self._load_diarize_pipeline()

                def do_diarize() -> dict[str, Any]:
                    diarize_segments = self._diarize_pipeline(audio)
                    return whisperx.assign_word_speakers(diarize_segments, result)

                result = await loop.run_in_executor(None, do_diarize)
                logger.info("Diarization complete")
            except Exception as e:
                logger.warning("Diarization failed", error=str(e))

        if on_progress:
            await on_progress(95, "Finalizing...")

        return TranscriptionResult.from_whisperx(result, detected_language)


class MediaDownloader:
    """Download media from URLs (YouTube, etc.)."""

    def __init__(self) -> None:
        self._temp_dir: tempfile.TemporaryDirectory[str] | None = None

    @property
    def temp_dir(self) -> Path:
        """Get temporary directory for downloads."""
        if self._temp_dir is None:
            self._temp_dir = tempfile.TemporaryDirectory(prefix="transcription_")
        return Path(self._temp_dir.name)

    def cleanup(self) -> None:
        """Cleanup temporary files."""
        if self._temp_dir:
            self._temp_dir.cleanup()
            self._temp_dir = None

    async def download(self, url: str, on_progress: Any | None = None) -> Path:
        """
        Download media from URL.

        Args:
            url: YouTube URL or direct media link
            on_progress: Callback for progress updates

        Returns:
            Path to downloaded file
        """
        import asyncio

        import yt_dlp

        if on_progress:
            await on_progress(5, "Preparing download...")

        output_path = self.temp_dir / "%(id)s.%(ext)s"

        ydl_opts = {
            "format": "bestaudio/best",
            "outtmpl": str(output_path),
            "postprocessors": [
                {
                    "key": "FFmpegExtractAudio",
                    "preferredcodec": "wav",
                    "preferredquality": "192",
                }
            ],
            "quiet": True,
            "no_warnings": True,
        }

        logger.info("Downloading media", url=url)

        loop = asyncio.get_event_loop()

        def do_download() -> str:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=True)
                # Get the actual output file
                if info:
                    return ydl.prepare_filename(info).replace(".webm", ".wav").replace(".m4a", ".wav")
            raise ValueError("Failed to extract info from URL")

        if on_progress:
            await on_progress(15, "Downloading...")

        downloaded_file = await loop.run_in_executor(None, do_download)

        logger.info("Download complete", path=downloaded_file)

        if on_progress:
            await on_progress(30, "Download complete")

        return Path(downloaded_file)
