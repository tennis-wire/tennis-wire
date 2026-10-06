import pytest

from parsing.urls import canonical_url, host_allowed, url_digest


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        # BBC tags feed links with at_medium and at_campaign
        (
            "https://www.bbc.co.uk/sport/tennis/articles/c3dx?at_medium=RSS&at_campaign=rss",
            "https://www.bbc.co.uk/sport/tennis/articles/c3dx",
        ),
        ("https://Example.COM/a?utm_source=x&id=7#comments", "https://example.com/a?id=7"),
        ("https://example.com/a?fbclid=1&gclid=2", "https://example.com/a"),
        ("https://example.com", "https://example.com/"),
        ("https://example.com:443/a", "https://example.com/a"),
        ("http://example.com:8080/a", "http://example.com:8080/a"),
        ("https://example.com/a?b=&c=1", "https://example.com/a?b=&c=1"),
    ],
)
def test_canonical_url(raw: str, expected: str) -> None:
    assert canonical_url(raw) == expected


@pytest.mark.parametrize(
    ("url", "allowed"),
    [
        ("https://example.com/a", True),
        ("https://www.example.com/a", True),
        ("http://news.example.com/a", True),
        ("https://badexample.com/a", False),
        ("https://example.com.evil.org/a", False),
        ("https://example.com@evil.org/a", False),
        ("https://user:pass@example.com/a", False),
        ("ftp://example.com/a", False),
        ("file:///etc/passwd", False),
        ("https://169.254.169.254/latest/meta-data", False),
        ("/relative/path", False),
    ],
)
def test_host_allowed(url: str, allowed: bool) -> None:
    assert host_allowed(url, ["example.com"]) is allowed


def test_url_digest_is_stable_and_short() -> None:
    assert url_digest("https://example.com/a") == url_digest("https://example.com/a")
    assert url_digest("https://example.com/a") != url_digest("https://example.com/b")
    assert len(url_digest("https://example.com/a")) == 32
