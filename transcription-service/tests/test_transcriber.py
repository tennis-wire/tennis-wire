"""Alignment model caching."""

from transcription.config import Settings
from transcription.worker.transcriber import Transcriber


def make_transcriber() -> Transcriber:
    return Transcriber(Settings(_env_file=None))


def test_nothing_cached_is_a_miss() -> None:
    assert not make_transcriber()._align_model_matches("en")


def test_same_language_is_a_hit() -> None:
    transcriber = make_transcriber()
    transcriber._align_model = object()
    transcriber._align_language = "en"

    assert transcriber._align_model_matches("en")


def test_other_language_is_a_miss() -> None:
    transcriber = make_transcriber()
    transcriber._align_model = object()
    transcriber._align_language = "en"

    assert not transcriber._align_model_matches("es")
