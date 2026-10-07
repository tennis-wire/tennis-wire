import pytest
from pydantic import ValidationError

from parsing.adapters import FeedError
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
