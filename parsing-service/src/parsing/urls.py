"""URL normalisation and the host allowlist."""

import hashlib
import re
from collections.abc import Sequence
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

# Campaign and click ids: the same article under them is still the same article
_TRACKING = re.compile(r"^(utm_.*|at_.*|fbclid|gclid|yclid|mc_cid|mc_eid|_ga)$", re.IGNORECASE)
_DEFAULT_PORTS = {"http": 80, "https": 443}


def canonical_url(url: str) -> str:
    """One spelling per article: lower-case host, no tracking parameters, no fragment."""
    parts = urlsplit(url.strip())
    scheme = parts.scheme.lower()
    host = (parts.hostname or "").rstrip(".").lower()
    netloc = host
    if parts.port is not None and parts.port != _DEFAULT_PORTS.get(scheme):
        netloc = f"{host}:{parts.port}"
    query = urlencode(
        [
            (k, v)
            for k, v in parse_qsl(parts.query, keep_blank_values=True)
            if not _TRACKING.match(k)
        ]
    )
    return urlunsplit((scheme, netloc, parts.path or "/", query, ""))


def host_of(url: str) -> str:
    return (urlsplit(url).hostname or "").rstrip(".").lower()


def host_allowed(url: str, hosts: Sequence[str]) -> bool:
    """Whether the collector may fetch the URL for a source with these hosts.

    Links in a feed point wherever its author wants, internal addresses included; this keeps
    the collector on the source's own sites. A subdomain of an entry is allowed too.
    """
    parts = urlsplit(url)
    if parts.scheme not in ("http", "https"):
        return False
    if parts.username or parts.password:
        return False
    host = host_of(url)
    return bool(host) and any(host == entry or host.endswith(f".{entry}") for entry in hosts)


def url_digest(url: str) -> str:
    """Short stable name for a URL: Redis keys, file names."""
    return hashlib.sha256(url.encode("utf-8")).hexdigest()[:32]
