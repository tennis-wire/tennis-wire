from datetime import UTC, datetime

import pytest

from parsing.adapters import FeedError
from parsing.adapters.rss import parse_rss
from tests.conftest import ProfileFactory, fixture_bytes


def test_tennis_majors_feed(make_profile: ProfileFactory) -> None:
    profile = make_profile(url="https://www.tennismajors.com/feed", hosts=["tennismajors.com"])

    entries = parse_rss(fixture_bytes("tennis-majors-feed.xml"), profile)

    assert len(entries) == 21
    first = entries[0]
    assert first.title.startswith("Djokovic wins seventh Beijing title")
    assert first.url.startswith("https://www.tennismajors.com/atp/djokovic-wins-seventh-beijing")
    assert first.external_id == "https://www.tennismajors.com/?p=862702"
    assert first.published_at == datetime(2026, 10, 6, 12, 40, 6, tzinfo=UTC)
    assert first.lead is not None
    assert first.lead.startswith("Novak Djokovic (No. 6) won his seventh China Open title")
    assert "<" not in first.lead
    assert first.author
    assert "ATP" in first.categories


def test_bounces_feed(make_profile: ProfileFactory) -> None:
    profile = make_profile(url="https://www.benrothenberg.com/feed", hosts=["benrothenberg.com"])

    entries = parse_rss(fixture_bytes("bounces-feed.xml"), profile)

    assert [entry.title for entry in entries][:2] == [
        "Daniil Medvedev Runs Into Unwritten Rule and Out of Luck",
        "Two Years Down, Ready For More at Bounces",
    ]
    assert entries[0].author == "Ben Rothenberg"
    assert entries[0].published_at == datetime(2026, 10, 6, 1, 57, 42, tzinfo=UTC)


def test_entries_without_link_or_title_are_skipped(make_profile: ProfileFactory) -> None:
    feed = b"""<?xml version="1.0"?><rss version="2.0"><channel><title>x</title>
      <item><title>No link</title></item>
      <item><link>https://example.com/no-title</link></item>
      <item><title>Both &amp; more</title><link>https://example.com/both</link></item>
    </channel></rss>"""

    entries = parse_rss(feed, make_profile())

    assert [(entry.title, entry.url) for entry in entries] == [
        ("Both & more", "https://example.com/both")
    ]
    assert entries[0].published_at is None
    assert entries[0].external_id is None


def test_unreadable_feed_is_an_error(make_profile: ProfileFactory) -> None:
    with pytest.raises(FeedError, match="unreadable feed"):
        parse_rss(b"<html><body>Not a feed", make_profile())
