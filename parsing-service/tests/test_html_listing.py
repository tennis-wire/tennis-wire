from datetime import UTC, date, datetime

import pytest
from pydantic import ValidationError

from parsing.adapters import FeedError, html_listing
from parsing.adapters.html_listing import parse_html_listing
from tests.conftest import ProfileFactory

# The shape of sports.ru/tennis/news/: days of short news, the lead in the link's title
NEWS = """<html><body><div class="news"><div class="short-news">
  <b>7 октября</b>
  <p><span class="time">22:03</span>
     <a class="short-text" href="/tennis/1-mertens.html" title="Элиза  Мертенс высказалась.">
       <strong>Мертенс: «Я доверяю партнерше»</strong></a>
     <span class="sp">|</span><a href="/tennis/1-mertens.html#comments">5</a></p>
  <p><span class="time">21:02</span>
     <a class="short-text" href="https://www.sports.ru/tennis/2-vashero.html?utm_source=x">
       <strong>Вашеро о защите титула</strong></a></p>
  <p><span class="time">20:00</span><a class="short-text" href="/tennis/1-mertens.html">
       <strong>Again, the same article</strong></a></p>
  <p><span class="time">19:00</span><a class="short-text" href="/tennis/3-empty.html"></a></p>
</div></div></body></html>"""

# The shape of sports.ru/tennis/: cards that link through a picture, a headline and comments
FRONT = """<html><body>
  <a href="/tennis/blogs/10.html"><img src="x.jpg"></a>
  <a href="/tennis/blogs/10.html">Так вот почему Джокович не завершает карьеру</a>
  <a href="/tennis/blogs/10.html#comments">65</a>
  <a href="/tennis/blogs/11.html">Календарь</a>
  <a href="/tennis/blogs/12.html"><img src="y.jpg"></a>
  <a href="/tennis/person/novak-djokovic/">Новак Джокович</a>
</body></html>"""


def news_profile(make_profile: ProfileFactory, **listing: str):  # type: ignore[no-untyped-def]
    return make_profile(
        kind="html",
        url="https://www.sports.ru/tennis/news/",
        hosts=["sports.ru"],
        listing=listing,
    )


def test_items_with_title_and_lead(make_profile: ProfileFactory) -> None:
    profile = news_profile(
        make_profile,
        item="div.short-news p",
        link="a.short-text",
        title="a.short-text strong",
        lead_attr="title",
    )

    entries = parse_html_listing(NEWS.encode(), profile)

    assert [(entry.url, entry.title, entry.lead) for entry in entries] == [
        (
            "https://www.sports.ru/tennis/1-mertens.html",
            "Мертенс: «Я доверяю партнерше»",
            "Элиза Мертенс высказалась.",
        ),
        ("https://www.sports.ru/tennis/2-vashero.html", "Вашеро о защите титула", None),
    ]
    # The time comes from the article page
    assert entries[0].published_at is None


def test_dates_from_day_headers_and_times(
    make_profile: ProfileFactory, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(html_listing, "_today", lambda zone: date(2026, 10, 8))
    page = """<html><body><div class="short-news">
      <b>Сегодня</b>
      <p><span class="time">01:30</span><a class="short-text" href="/tennis/3-c.html">C</a></p>
      <b>7 октября</b>
      <p><span class="time">22:03</span><a class="short-text" href="/tennis/1-a.html">A</a></p>
      <p><a class="short-text" href="/tennis/2-b.html">B, no time</a></p>
    </div></body></html>"""
    profile = news_profile(
        make_profile,
        item="div.short-news p",
        link="a.short-text",
        day="div.short-news > b",
        time="span.time",
        timezone="Europe/Moscow",
    )

    entries = parse_html_listing(page.encode(), profile)

    assert [(entry.title, entry.published_at) for entry in entries] == [
        ("C", datetime(2026, 10, 7, 22, 30, tzinfo=UTC)),
        ("A", datetime(2026, 10, 7, 19, 3, tzinfo=UTC)),
        ("B, no time", None),
    ]


@pytest.mark.parametrize(
    ("text", "expected"),
    [
        ("7 октября ", date(2026, 10, 7)),
        ("Вчера", date(2026, 10, 7)),
        ("28 декабря", date(2025, 12, 28)),
        ("1 января 2027", date(2027, 1, 1)),
        ("31 февраля", None),
        ("на днях", None),
    ],
)
def test_day_headers(text: str, expected: date | None) -> None:
    assert html_listing._day(text, date(2026, 10, 8)) == expected


def test_an_unknown_zone_is_refused(make_profile: ProfileFactory) -> None:
    with pytest.raises(ValidationError):
        news_profile(make_profile, link="a", timezone="Mars/Olympus")


def test_links_alone_take_the_longest_text(make_profile: ProfileFactory) -> None:
    profile = news_profile(make_profile, link='a[href*="/tennis/blogs/"]')

    entries = parse_html_listing(FRONT.encode(), profile)

    assert [(entry.url, entry.title) for entry in entries] == [
        (
            "https://www.sports.ru/tennis/blogs/10.html",
            "Так вот почему Джокович не завершает карьеру",
        ),
        ("https://www.sports.ru/tennis/blogs/11.html", "Календарь"),
    ]


def test_a_page_the_selectors_no_longer_fit(make_profile: ProfileFactory) -> None:
    profile = news_profile(make_profile, item="div.news-list li", link="a")

    with pytest.raises(FeedError, match="no entries matched"):
        parse_html_listing(NEWS.encode(), profile)


def test_listing_goes_with_kind_html(make_profile: ProfileFactory) -> None:
    with pytest.raises(ValidationError, match="listing goes with kind html"):
        make_profile(kind="html")
    with pytest.raises(ValidationError, match="listing goes with kind html"):
        make_profile(listing={"link": "a"})
