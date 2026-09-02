"""Input validation shared by the API and the worker."""

from urllib.parse import urlsplit


def check_media_url_allowed(url: str, allowed_hosts: list[str]) -> None:
    """Raise ValueError unless the URL points at an allowlisted host.

    This is the control that keeps yt-dlp from being pointed at internal
    addresses. Matching is on the parsed hostname, so credentials in the
    authority (``https://youtube.com@internal/``) resolve to the real host
    and are rejected like any other.
    """
    parts = urlsplit(url)

    if parts.scheme != "https":
        raise ValueError("Only https URLs are accepted")

    if parts.username or parts.password:
        raise ValueError("URLs with credentials are not accepted")

    host = (parts.hostname or "").rstrip(".").lower()
    if not host:
        raise ValueError("URL has no host")

    allowed = any(host == entry or host.endswith(f".{entry}") for entry in allowed_hosts)
    if not allowed:
        raise ValueError(f"Host {host} is not in the allowed media hosts")
