"""Google News sitemaps: address, title, date. No lead: that comes from the page."""

from datetime import UTC, datetime

from lxml import etree

from parsing.adapters.base import FeedEntry, FeedError
from parsing.sources import SourceProfile
from parsing.text import html_to_text

_NS = {
    "sm": "http://www.sitemaps.org/schemas/sitemap/0.9",
    "news": "http://www.google.com/schemas/sitemap-news/0.9",
}
# The XML comes from another site: no entities, no DTD, no network
_PARSER = etree.XMLParser(resolve_entities=False, no_network=True, load_dtd=False, huge_tree=False)


def parse_news_sitemap(
    body: bytes, profile: SourceProfile, encoding: str | None = None
) -> list[FeedEntry]:
    # XML declares its own encoding
    try:
        root = etree.fromstring(body, parser=_PARSER)
    except etree.XMLSyntaxError as error:
        raise FeedError(f"{profile.key}: unreadable sitemap: {error}") from error
    if root is None or etree.QName(root).localname != "urlset":
        raise FeedError(f"{profile.key}: not a sitemap urlset")

    entries: list[FeedEntry] = []
    for url in root.iterfind("sm:url", _NS):
        link = (url.findtext("sm:loc", namespaces=_NS) or "").strip()
        title = html_to_text(url.findtext("news:news/news:title", namespaces=_NS))
        if not link or not title:
            continue
        entries.append(
            FeedEntry(
                url=link,
                external_id=None,
                title=title,
                published_at=_when(url.findtext("news:news/news:publication_date", namespaces=_NS)),
                lead=None,
                author=None,
                categories=_keywords(url.findtext("news:news/news:keywords", namespaces=_NS)),
            )
        )
    return entries


def _when(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        # W3C datetime; a bare date is allowed too
        parsed = datetime.fromisoformat(value.strip().replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=UTC)
    return parsed.astimezone(UTC)


def _keywords(value: str | None) -> tuple[str, ...]:
    words = (word.strip() for word in (value or "").split(","))
    return tuple(dict.fromkeys(word for word in words if word))
