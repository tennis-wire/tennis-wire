from datetime import UTC, datetime

import pytest

from parsing.adapters import FeedError
from parsing.adapters.news_sitemap import parse_news_sitemap
from tests.conftest import ProfileFactory, fixture_bytes


def test_eurosport_sitemap(make_profile: ProfileFactory) -> None:
    profile = make_profile(
        url="https://www.eurosport.fr/sitemaps/news/sitemap-news-recent.xml",
        hosts=["eurosport.fr"],
    )

    entries = parse_news_sitemap(fixture_bytes("eurosport-fr-sitemap.xml"), profile)

    assert len(entries) == 6
    tennis = [entry for entry in entries if "/tennis/" in entry.url]
    assert len(tennis) == 4
    first = tennis[0]
    assert first.url.startswith("https://www.eurosport.fr/tennis/")
    assert first.title
    assert first.published_at is not None
    assert first.published_at.tzinfo is UTC
    # A sitemap carries no lead and no stable id other than the address
    assert (first.lead, first.external_id, first.author) == (None, None, None)


def test_dates_titles_and_keywords(make_profile: ProfileFactory) -> None:
    sitemap = b"""<?xml version="1.0" encoding="UTF-8"?>
    <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
            xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
      <url><loc>https://example.com/a</loc><news:news>
        <news:publication_date>2026-10-06T17:49:03+02:00</news:publication_date>
        <news:title> Sinner &amp; Alcaraz </news:title>
        <news:keywords>ATP, Tokyo, ATP</news:keywords>
      </news:news></url>
      <url><loc>https://example.com/b</loc><news:news>
        <news:publication_date>2026-10-06</news:publication_date>
        <news:title>Date only</news:title>
      </news:news></url>
      <url><loc>https://example.com/c</loc><news:news>
        <news:publication_date>yesterday</news:publication_date>
        <news:title>Bad date</news:title>
      </news:news></url>
      <url><loc>https://example.com/no-news</loc></url>
    </urlset>"""

    entries = parse_news_sitemap(sitemap, make_profile())

    assert [entry.url for entry in entries] == [
        "https://example.com/a",
        "https://example.com/b",
        "https://example.com/c",
    ]
    assert entries[0].title == "Sinner & Alcaraz"
    assert entries[0].published_at == datetime(2026, 10, 6, 15, 49, 3, tzinfo=UTC)
    assert entries[0].categories == ("ATP", "Tokyo")
    assert entries[1].published_at == datetime(2026, 10, 6, tzinfo=UTC)
    assert entries[2].published_at is None


def test_entities_are_not_expanded(make_profile: ProfileFactory) -> None:
    sitemap = b"""<?xml version="1.0"?>
    <!DOCTYPE urlset [<!ENTITY secret SYSTEM "file:///etc/passwd">]>
    <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
            xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
      <url><loc>https://example.com/a</loc><news:news>
        <news:title>Title &secret;</news:title>
      </news:news></url>
    </urlset>"""

    entries = parse_news_sitemap(sitemap, make_profile())

    assert "root:" not in entries[0].title


@pytest.mark.parametrize(
    "body",
    [
        b"<html><body>Not a sitemap</body></html>",
        b"<?xml version='1.0'?><sitemapindex xmlns='http://www.sitemaps.org/schemas/sitemap/0.9'/>",
        b"not xml at all <",
    ],
)
def test_not_a_news_sitemap(make_profile: ProfileFactory, body: bytes) -> None:
    with pytest.raises(FeedError):
        parse_news_sitemap(body, make_profile())
