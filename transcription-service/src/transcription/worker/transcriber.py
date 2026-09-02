"""WhisperX transcriber implementation."""

import asyncio
import tempfile
from pathlib import Path
from typing import Any, cast

import structlog

from transcription.config import Settings
from transcription.models import TranscriptionResult
from transcription.worker.media import check_duration

logger = structlog.get_logger()

# FFmpegExtractAudio always writes this codec, whatever the source container is.
AUDIO_CODEC = "wav"


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
        import whisperx

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
        # whisperx dropped the package-root re-export: since 3.4 this lives in
        # whisperx.diarize, and the old call raised AttributeError that the
        # caller's broad except swallowed as "diarization failed".
        from whisperx.diarize import DiarizationPipeline

        if self._diarize_pipeline is not None:
            return

        if not self.settings.hf_token:
            raise ValueError("HF_TOKEN required for speaker diarization")

        logger.info("Loading diarization pipeline")
        self._diarize_pipeline = DiarizationPipeline(
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
        import whisperx

        loop = asyncio.get_running_loop()
        self.load_model()

        # Progress: 0-30% - transcription
        if on_progress:
            await on_progress(5, "Loading audio...")

        logger.info("Starting transcription", path=str(audio_path))

        # Load audio (blocking -> run in executor)
        audio = await loop.run_in_executor(None, lambda: whisperx.load_audio(str(audio_path)))

        if on_progress:
            await on_progress(10, "Transcribing...")

        # Transcribe (blocking -> run in executor)
        model = self._model
        if model is None:
            raise RuntimeError("Model not loaded — call load_model() first")

        def do_transcribe() -> dict[str, Any]:
            return cast(
                "dict[str, Any]",
                model.transcribe(audio, batch_size=16, language=language),
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
                return cast(
                    "dict[str, Any]",
                    whisperx.align(
                        result["segments"],
                        self._align_model,
                        self._align_metadata,
                        audio,
                        self.device,
                        return_char_alignments=False,
                    ),
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

                pipeline = self._diarize_pipeline
                if pipeline is None:
                    raise RuntimeError("Diarization pipeline not loaded")

                def do_diarize() -> dict[str, Any]:
                    diarize_segments = pipeline(audio)
                    return cast(
                        "dict[str, Any]",
                        whisperx.assign_word_speakers(diarize_segments, result),
                    )

                result = await loop.run_in_executor(None, do_diarize)
                logger.info("Diarization complete")
            except Exception as e:
                logger.warning("Diarization failed", error=str(e))

        if on_progress:
            await on_progress(95, "Finalizing...")

        return TranscriptionResult.from_whisperx(result, detected_language)


class MediaDownloader:
    """Download media from URLs (YouTube, etc.)."""

    def __init__(self, settings: Settings) -> None:
        self.settings = settings
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

        import yt_dlp

        if on_progress:
            await on_progress(5, "Preparing download...")

        output_path = self.temp_dir / "%(id)s.%(ext)s"

        ydl_opts = {
            "format": "bestaudio/best",
            # A playlist URL would otherwise queue every entry behind a single job.
            "noplaylist": True,
            # Hard stop mid-download for sources that omit or misreport duration.
            "max_filesize": self.settings.max_file_size_bytes,
            "outtmpl": str(output_path),
            "postprocessors": [
                {
                    "key": "FFmpegExtractAudio",
                    "preferredcodec": AUDIO_CODEC,
                    "preferredquality": "192",
                }
            ],
            "quiet": True,
            "no_warnings": True,
        }

        loop = asyncio.get_running_loop()

        def probe() -> dict[str, Any]:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=False)
                if not info:
                    raise ValueError("Failed to extract media info from URL")
                return cast("dict[str, Any]", info)

        info = await loop.run_in_executor(None, probe)
        check_duration(info.get("duration"), self.settings.max_duration_seconds)

        logger.info("Downloading media", url=url, duration=info.get("duration"))

        def do_download() -> Path:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                result = ydl.extract_info(url, download=True)
                if not result:
                    raise ValueError("Failed to extract media info from URL")

                # After postprocessing yt-dlp records the real output path here.
                # prepare_filename() still reports the pre-conversion container, so
                # the fallback swaps in the codec extension rather than guessing.
                downloads = result.get("requested_downloads") or []
                filepath = downloads[0].get("filepath") if downloads else None
                path = (
                    Path(filepath)
                    if filepath
                    else Path(ydl.prepare_filename(result)).with_suffix(f".{AUDIO_CODEC}")
                )

                if not path.exists():
                    raise ValueError(f"Downloaded audio not found: {path}")
                return path

        if on_progress:
            await on_progress(15, "Downloading...")

        downloaded_file = await loop.run_in_executor(None, do_download)

        logger.info("Download complete", path=downloaded_file)

        if on_progress:
            await on_progress(30, "Download complete")

        return downloaded_file
