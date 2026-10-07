"""A site's own list page: links to articles found by the profile's selectors.

The most fragile rung (architecture/aggregator.md section 4.5): a redesign breaks it, and the
source's health shows it (section 4.11).
"""

from urllib.parse import urljoin

import lxml.html
from lxml.etree import ParserError

from parsing.adapters.base import FeedEntry, FeedError
from parsing.sources import SourceProfile
from parsing.text import html_to_text, parse_html
from parsing.urls import canonical_url


def parse_html_listing(
    body: bytes, profile: SourceProfile, encoding: str | None = None
) -> list[FeedEntry]:
    rules = profile.listing
    if rules is None:
        raise FeedError(f"{profile.key}: no listing rules")
    try:
        tree = parse_html(body, encoding)
    except (ParserError, ValueError) as error:
        raise FeedError(f"{profile.key}: unparsable page: {error}") from error
    base = str(profile.url)

    found: dict[str, FeedEntry] = {}
    if rules.item:
        for item in tree.cssselect(rules.item):
            links = item.cssselect(rules.link)
            if not links or not links[0].get("href"):
                continue
            link = links[0]
            # A card links to the article and to its comments (#comments): one article
            url = canonical_url(urljoin(base, link.get("href", "")))
            heads = item.cssselect(rules.title) if rules.title else [link]
            title = (
                html_to_text(lxml.html.tostring(heads[0], encoding="unicode")) if heads else None
            )
            if not title or url in found:
                continue
            lead = html_to_text(link.get(rules.lead_attr)) if rules.lead_attr else None
            found[url] = _entry(url, title, lead)
    else:
        # Every matching link is an entry; a card often links twice, through its picture and
        # its headline, so the longest text wins
        titles: dict[str, str] = {}
        for link in tree.cssselect(rules.link):
            if not link.get("href"):
                continue
            url = canonical_url(urljoin(base, link.get("href", "")))
            text = html_to_text(lxml.html.tostring(link, encoding="unicode")) or ""
            if len(text) > len(titles.get(url, "")):
                titles[url] = text
            else:
                titles.setdefault(url, "")
        found = {url: _entry(url, title, None) for url, title in titles.items() if title}

    if not found:
        # A list page with no entries at all is a page the selectors no longer fit
        raise FeedError(f"{profile.key}: no entries matched the listing selectors")
    return list(found.values())


def _entry(url: str, title: str, lead: str | None) -> FeedEntry:
    return FeedEntry(
        url=url,
        external_id=None,
        title=title,
        # From the article page (the profile's extract.published)
        published_at=None,
        lead=lead,
        author=None,
        categories=(),
    )
