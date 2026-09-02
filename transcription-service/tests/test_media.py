"""Duration limit for media downloads."""

import json

import pytest

from transcription.worker.media import check_duration, parse_media_duration


def test_accepts_media_within_limit() -> None:
    check_duration(600.0, 3600)


def test_rejects_media_over_limit() -> None:
    with pytest.raises(ValueError, match="limit is 60 min"):
        check_duration(3601.0, 3600)


def test_rejects_unknown_duration() -> None:
    with pytest.raises(ValueError, match="duration"):
        check_duration(None, 3600)


AUDIO_PROBE = json.dumps(
    {
        "streams": [{"codec_type": "video"}, {"codec_type": "audio"}],
        "format": {"duration": "3600.5"},
    }
)


def test_parses_duration_from_probe() -> None:
    assert parse_media_duration(AUDIO_PROBE) == 3600.5


def test_rejects_file_without_audio_stream() -> None:
    payload = json.dumps({"streams": [{"codec_type": "video"}], "format": {"duration": "10"}})
    with pytest.raises(ValueError, match="no audio stream"):
        parse_media_duration(payload)


def test_rejects_probe_without_duration() -> None:
    payload = json.dumps({"streams": [{"codec_type": "audio"}], "format": {}})
    with pytest.raises(ValueError, match="duration"):
        parse_media_duration(payload)
