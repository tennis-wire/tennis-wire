from datetime import UTC, datetime, timedelta
from email.utils import format_datetime

import httpx
import pytest

from parsing.blocks import detect_block, is_consent_redirect, retry_after
from parsing.models import BlockKind

URL = "https://example.com/a"


def _detect(status: int, body: bytes = b"<html></html>", **headers: str) -> BlockKind | None:
    block = detect_block(status, httpx.Headers(headers), body, URL)
    return block.kind if block else None


def test_ordinary_answers_are_not_blocks() -> None:
    assert _detect(200) is None
    assert _detect(404) is None
    assert _detect(500) is None
    # A server error, not a wall
    assert _detect(503) is None
    # A comment form with reCAPTCHA on a normal page
    assert _detect(200, b'<div class="g-recaptcha"></div>') is None


def test_status_codes() -> None:
    assert _detect(403) is BlockKind.FORBIDDEN
    assert _detect(429) is BlockKind.TOO_MANY_REQUESTS
    assert _detect(451) is BlockKind.LEGAL


def test_akamai_empty_202() -> None:
    assert _detect(202, b"") is BlockKind.CHALLENGE
    assert _detect(202, b"<html>accepted</html>") is None


@pytest.mark.parametrize(
    "body",
    [
        b"<title>Just a moment...</title>",
        b"<TITLE>Attention Required! | Cloudflare</TITLE>",
        b'<script src="/cdn-cgi/challenge-platform/h/b/orchestrate"></script>',
    ],
)
def test_cloudflare_challenge(body: bytes) -> None:
    assert _detect(403, body) is BlockKind.CHALLENGE
    assert _detect(503, body) is BlockKind.CHALLENGE


def test_cf_mitigated_header() -> None:
    assert _detect(200, **{"cf-mitigated": "challenge"}) is BlockKind.CHALLENGE


def test_captcha_page() -> None:
    assert _detect(405, b'<script src="https://ct.captcha-delivery.com/c.js">') is (
        BlockKind.CAPTCHA
    )


def test_retry_after_is_kept() -> None:
    block = detect_block(429, httpx.Headers({"retry-after": "120"}), b"", URL)

    assert block is not None
    assert block.retry_after_seconds == 120


def test_retry_after_forms() -> None:
    later = datetime.now(UTC) + timedelta(minutes=10)

    assert retry_after(None) is None
    assert retry_after("30") == 30
    assert 590 <= (retry_after(format_datetime(later, usegmt=True)) or 0) <= 600
    assert retry_after("soon") is None


@pytest.mark.parametrize(
    ("url", "consent"),
    [
        ("https://consent.yahoo.com/v2/collectConsent?sessionId=1", True),
        ("https://www.example.com/gdpr-consent?return=/a", True),
        ("https://www.example.com/privacy/consent/", True),
        ("https://www.example.com/tennis/consentino-wins-final", False),
        ("https://www.example.com/tennis/a", False),
    ],
)
def test_consent_redirect(url: str, consent: bool) -> None:
    assert is_consent_redirect(url) is consent
