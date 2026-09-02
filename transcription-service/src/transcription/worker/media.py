"""Media inspection: duration limits and format verification."""

import asyncio
import json
from pathlib import Path


def check_duration(duration: float | None, max_seconds: int) -> None:
    """Reject media longer than the configured limit.

    Media with unknown duration is rejected too: there is no way to bound the
    work it would cost.
    """
    if duration is None:
        raise ValueError("Could not determine media duration")
    if duration > max_seconds:
        raise ValueError(
            f"Media is {int(duration) // 60} min long, limit is {max_seconds // 60} min"
        )


def parse_media_duration(payload: str) -> float:
    """Read duration out of ffprobe JSON, rejecting anything without audio.

    Kept separate from the subprocess call so it can be tested without ffprobe
    on the machine.
    """
    data = json.loads(payload)

    streams = data.get("streams", [])
    if not any(stream.get("codec_type") == "audio" for stream in streams):
        raise ValueError("File contains no audio stream")

    raw = data.get("format", {}).get("duration")
    if raw is None:
        raise ValueError("Could not determine media duration")
    return float(raw)


async def probe_media(path: Path) -> float:
    """Return the duration of a local media file, verifying it really is one.

    The client-declared content type is not evidence: the browser sets it and
    it can say anything. ffprobe reads the container itself, so an .mp3 that is
    actually a zip fails here instead of deep inside whisperx.
    """
    proc = await asyncio.create_subprocess_exec(
        "ffprobe",
        "-v",
        "error",
        "-print_format",
        "json",
        "-show_format",
        "-show_streams",
        str(path),
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout, stderr = await proc.communicate()

    if proc.returncode != 0:
        detail = stderr.decode(errors="replace").strip()[:200]
        raise ValueError(f"File is not readable media: {detail}")

    return parse_media_duration(stdout.decode())
