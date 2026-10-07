"""RSS and Atom, through feedparser."""

import time
from datetime import UTC, datetime
from typing import Any

import feedparser

from parsing.adapters.base import FeedEntry, FeedError
from parsing.sources import SourceProfile
from parsing.text import html_to_text


def parse_rss(body: bytes, profile: SourceProfile, encoding: str | None = None) -> list[FeedEntry]:
    # XML declares its own encoding
    feed = feedparser.parse(body)
    # bozo alone is common (a stray entity, a wrong content type); no entries with it is not
    if feed.bozo and not feed.entries:
        raise FeedError(f"{profile.key}: unreadable feed: {feed.get('bozo_exception')}")
    entries: list[FeedEntry] = []
    for entry in feed.entries:
        link = entry.get("link")
        title = html_to_text(entry.get("title"))
        if not link or not title:
            continue
        entries.append(
            FeedEntry(
                url=link,
                external_id=entry.get("id") or None,
                title=title,
                published_at=_when(entry.get("published_parsed") or entry.get("updated_parsed")),
                lead=html_to_text(entry.get("summary")),
                author=(entry.get("author") or "").strip() or None,
                categories=_terms(entry.get("tags")),
            )
        )
    return entries


def _when(parsed: time.struct_time | None) -> datetime | None:
    # feedparser normalises dates to UTC
    if parsed is None:
        return None
    return datetime(*parsed[:6], tzinfo=UTC)


def _terms(tags: list[dict[str, Any]] | None) -> tuple[str, ...]:
    terms = (str(tag.get("term") or "").strip() for tag in tags or [])
    return tuple(dict.fromkeys(term for term in terms if term))
