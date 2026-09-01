"""Duration limit for media downloads."""

import pytest

from transcription.worker.transcriber import check_duration


def test_accepts_media_within_limit() -> None:
    check_duration({"duration": 600.0}, 3600)


def test_rejects_media_over_limit() -> None:
    with pytest.raises(ValueError, match="limit is 60 min"):
        check_duration({"duration": 3601.0}, 3600)


def test_rejects_unknown_duration() -> None:
    with pytest.raises(ValueError, match="duration"):
        check_duration({}, 3600)
