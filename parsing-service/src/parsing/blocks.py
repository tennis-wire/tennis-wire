"""Telling a refusal from an answer: architecture/aggregator.md section 4.7."""

import re
from datetime import UTC, datetime
from email.utils import parsedate_to_datetime

import httpx

from parsing.models import Block, BlockKind

# Interstitials of the anti-bot services: a page that only a browser gets past
_CHALLENGE = (
    b"just a moment...",
    b"attention required! | cloudflare",
    b"/cdn-cgi/challenge-platform/",
    b"_cf_chl_opt",
)
_CAPTCHA = (b"g-recaptcha", b"h-captcha", b"hcaptcha.com", b"captcha-delivery.com")
_CONSENT = re.compile(r"(^|[./])(consent|gdpr|cookie[-_]?consent)([./-]|$)", re.IGNORECASE)
# Markers sit in the head of an interstitial; the whole body is not worth scanning
_SCAN_BYTES = 64 * 1024


def detect_block(status: int, headers: httpx.Headers, body: bytes, url: str) -> Block | None:
    """A Block if the response is a refusal rather than the page or an error of the site."""
    head = body[:_SCAN_BYTES].lower()
    if status == 429:
        return Block(
            kind=BlockKind.TOO_MANY_REQUESTS,
            http_status=status,
            url=url,
            retry_after_seconds=retry_after(headers.get("retry-after")),
        )
    if status == 451:
        return Block(kind=BlockKind.LEGAL, http_status=status, url=url)
    # Akamai answers an unknown client with an empty 202 and a script-set cookie
    if status == 202 and not body.strip():
        return Block(kind=BlockKind.CHALLENGE, http_status=status, url=url, detail="empty 202")
    if headers.get("cf-mitigated") == "challenge" or (
        status in (403, 503) and any(marker in head for marker in _CHALLENGE)
    ):
        return Block(kind=BlockKind.CHALLENGE, http_status=status, url=url)
    # A reCAPTCHA on a 200 page is usually a comment form, not a wall
    if status >= 400 and any(marker in head for marker in _CAPTCHA):
        return Block(kind=BlockKind.CAPTCHA, http_status=status, url=url)
    if status == 403:
        return Block(kind=BlockKind.FORBIDDEN, http_status=status, url=url)
    return None


def is_consent_redirect(url: str) -> bool:
    """A redirect to a cookie or privacy consent page instead of the content."""
    return bool(_CONSENT.search(url))


def retry_after(value: str | None) -> int | None:
    """Seconds from a Retry-After header: delta-seconds or an HTTP date."""
    if not value:
        return None
    value = value.strip()
    if value.isdigit():
        return int(value)
    try:
        when = parsedate_to_datetime(value)
    except (TypeError, ValueError):
        return None
    if when.tzinfo is None:
        when = when.replace(tzinfo=UTC)
    return max(0, int((when - datetime.now(UTC)).total_seconds()))
