"""A site's own list page: links to articles found by the profile's selectors.

The most fragile rung (architecture/aggregator.md section 4.5): a redesign breaks it, and the
source's health shows it (section 4.11).
"""

import re
from datetime import UTC, date, datetime, time, timedelta
from typing import Any
from urllib.parse import urljoin
from zoneinfo import ZoneInfo

import lxml.html
from lxml.etree import ParserError

from parsing.adapters.base import FeedEntry, FeedError
from parsing.sources import ListingRules, SourceProfile
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
        for item, day in _items_with_days(tree, rules):
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
            found[url] = _entry(url, title, lead, _published(item, day, rules))
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
        found = {url: _entry(url, title, None, None) for url, title in titles.items() if title}

    if not found:
        # A list page with no entries at all is a page the selectors no longer fit
        raise FeedError(f"{profile.key}: no entries matched the listing selectors")
    return list(found.values())


def _entry(url: str, title: str, lead: str | None, published: datetime | None) -> FeedEntry:
    return FeedEntry(
        url=url,
        external_id=None,
        title=title,
        # Without a date in the list, the article page gives it (the profile's extract.published)
        published_at=published,
        lead=lead,
        author=None,
        categories=(),
    )


# Russian month names in the genitive, as a date is written ("7 oktyabrya"). Escaped: the
# source stays ASCII
_MONTHS = {
    "\u044f\u043d\u0432\u0430\u0440\u044f": 1,  # yanvarya
    "\u0444\u0435\u0432\u0440\u0430\u043b\u044f": 2,  # fevralya
    "\u043c\u0430\u0440\u0442\u0430": 3,  # marta
    "\u0430\u043f\u0440\u0435\u043b\u044f": 4,  # aprelya
    "\u043c\u0430\u044f": 5,  # maya
    "\u0438\u044e\u043d\u044f": 6,  # iyunya
    "\u0438\u044e\u043b\u044f": 7,  # iyulya
    "\u0430\u0432\u0433\u0443\u0441\u0442\u0430": 8,  # avgusta
    "\u0441\u0435\u043d\u0442\u044f\u0431\u0440\u044f": 9,  # sentyabrya
    "\u043e\u043a\u0442\u044f\u0431\u0440\u044f": 10,  # oktyabrya
    "\u043d\u043e\u044f\u0431\u0440\u044f": 11,  # noyabrya
    "\u0434\u0435\u043a\u0430\u0431\u0440\u044f": 12,  # dekabrya
}
_DAY = re.compile("(\\d{1,2})\\s+([\u0430-\u044f\u0451]+)(?:\\s+(\\d{4}))?")
_TIME = re.compile(r"(\d{1,2}):(\d{2})")


def _items_with_days(
    tree: lxml.html.HtmlElement, rules: ListingRules
) -> list[tuple[Any, str | None]]:
    """The items in page order, each with the text of the last day header before it."""
    items = tree.cssselect(rules.item or "")
    if not rules.day:
        return [(item, None) for item in items]
    days = tree.cssselect(rules.day)
    item_set, day_set = set(items), set(days)
    paired: list[tuple[Any, str | None]] = []
    current: str | None = None
    for element in tree.iter():
        if element in day_set:
            current = element.text_content()
        elif element in item_set:
            paired.append((element, current))
    return paired


def _published(item: Any, day_text: str | None, rules: ListingRules) -> datetime | None:
    if not rules.time or day_text is None:
        return None
    times = item.cssselect(rules.time)
    match = _TIME.search(times[0].text_content()) if times else None
    zone = ZoneInfo(rules.timezone)
    day = _day(day_text, _today(zone))
    if match is None or day is None:
        return None
    clock = time(int(match.group(1)), int(match.group(2)))
    return datetime.combine(day, clock, tzinfo=zone).astimezone(UTC)


def _day(text: str, today: date) -> date | None:
    text = text.strip().lower()
    if text.startswith("\u0441\u0435\u0433\u043e\u0434\u043d\u044f"):  # segodnya, today
        return today
    if text.startswith("\u0432\u0447\u0435\u0440\u0430"):  # vchera, yesterday
        return today - timedelta(days=1)
    match = _DAY.search(text)
    if match is None or match.group(2) not in _MONTHS:
        return None
    year = int(match.group(3)) if match.group(3) else today.year
    try:
        day = date(year, _MONTHS[match.group(2)], int(match.group(1)))
    except ValueError:
        return None
    # "28 dekabrya" read on the 2nd of January is last year's
    if match.group(3) is None and day > today + timedelta(days=1):
        day = day.replace(year=year - 1)
    return day


def _today(zone: ZoneInfo) -> date:
    return datetime.now(zone).date()
