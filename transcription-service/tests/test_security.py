"""Media URL allowlist."""

import pytest

from transcription.security import check_media_url_allowed

HOSTS = ["youtube.com", "youtu.be"]


@pytest.mark.parametrize(
    "url",
    [
        "https://youtube.com/watch?v=abc",
        "https://www.youtube.com/watch?v=abc",
        "https://m.youtube.com/watch?v=abc",
        "https://youtu.be/abc",
    ],
)
def test_accepts_allowlisted_hosts(url: str) -> None:
    check_media_url_allowed(url, HOSTS)


@pytest.mark.parametrize(
    "url",
    [
        "https://evil.com/video",
        "https://notyoutube.com/watch",  # suffix must be on a dot boundary
        "https://youtube.com.evil.com/watch",  # allowlisted name as a prefix
        "https://youtube.com@evil.com/watch",  # credentials in the authority
        "http://youtube.com/watch?v=abc",  # plaintext
        "https://169.254.169.254/latest/meta-data/",
        "https://localhost:8001/api/transcribe/url",
    ],
)
def test_rejects_everything_else(url: str) -> None:
    with pytest.raises(ValueError):
        check_media_url_allowed(url, HOSTS)
