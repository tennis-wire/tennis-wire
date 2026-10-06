import re
from pathlib import Path
from urllib.parse import quote

import lxml.html
import pytest

from parsing.extract import ExtractionError, extract_article, find_embeds
from parsing.sources import ExtractRules, load_sources
from tests.conftest import fixture_bytes

NO_RULES = ExtractRules()

TM_URL = (
    "https://www.tennismajors.com/atp/djokovic-wins-seventh-beijing-title-and-102nd-career-crown"
    "-as-injured-de-minaur-retires-862702.html"
)


def test_tennis_majors_article() -> None:
    article = extract_article(fixture_bytes("tennis-majors-final.html"), TM_URL, NO_RULES)

    assert article.text.startswith("# Djokovic wins seventh Beijing title")
    assert "Alex de Minaur, the No. 5 seed, retired injured" in article.text
    assert article.text.endswith("his record against the Top 10 this season at 6-2.")
    # Paragraphs are kept apart
    assert "\n\n" in article.text
    assert article.canonical_url == TM_URL
    assert article.image_url
    assert article.lead
    assert article.embeds == ("https://www.youtube.com/watch?v=XTUUmvDTjKo",)


def test_drop_selector_removes_an_element() -> None:
    html = _page(
        "<article><p>First paragraph of the story, long enough to count as text.</p>"
        "<p class='promo'>Subscribe to our newsletter for daily tennis updates.</p>"
        "<p>Second paragraph of the story, also long enough to count as text.</p></article>"
    )

    with_promo = extract_article(html, "https://example.com/a", NO_RULES)
    without = extract_article(html, "https://example.com/a", ExtractRules(drop=(".promo",)))

    assert "newsletter" in with_promo.text
    assert "newsletter" not in without.text
    assert "Second paragraph" in without.text


def test_body_selector_narrows_the_page() -> None:
    html = _page(
        "<div id='story'><p>The story itself, a sentence long enough to be kept as text.</p></div>"
        "<div id='other'><p>Something else entirely, also a sentence long enough to keep.</p></div>"
    )

    article = extract_article(html, "https://example.com/a", ExtractRules(body="#story"))

    assert "story itself" in article.text
    assert "Something else" not in article.text


def test_paragraphs_dropped_by_their_text() -> None:
    html = _page(
        "<article><p>First paragraph of the story, long enough to count as text.</p>"
        "<p><b>Read also:</b> <a href='/x'>Another story</a></p>"
        "<p>Second paragraph of the story, also long enough to count as text.</p></article>"
    )
    rules = ExtractRules(drop_paragraphs=(re.compile("^Read also"),))

    article = extract_article(html, "https://example.com/a", rules)

    assert "Another story" not in article.text
    assert "Second paragraph" in article.text


def test_eurosport_profile_takes_the_body_without_promos() -> None:
    sources = load_sources(Path(__file__).parent.parent / "sources.yaml")
    url = (
        "https://www.eurosport.de/tennis/atp-peking/2026/novak-djokovic-gewinnt-siebten-titel"
        "-chinesischer-hauptstadt-alex-de-minaur-muss-aufgeben_sto23343304/story.shtml"
    )

    article = extract_article(
        fixture_bytes("eurosport-de-story.html"), url, sources["eurosport-de"].extract
    )

    assert article.text.startswith("Novak Djokovic hat seiner beeindruckenden Karriere")
    assert article.text.endswith("(SID)")
    for junk in ("Das könnte Dich", "Eurosport bei Google", "Von Eurosport", "Quelle:"):
        assert junk not in article.text
    assert article.lead


def test_tnt_sports_profile_drops_the_closing_promos() -> None:
    sources = load_sources(Path(__file__).parent.parent / "sources.yaml")
    url = "https://www.tntsports.co.uk/tennis/jannik-sinner-injury-2026-season-end_sto23343223/story.shtml"

    article = extract_article(
        fixture_bytes("tnt-sports-story.html"), url, sources["tnt-sports"].extract
    )

    assert "Sinner" in article.text
    for junk in ("React to this story", "preferred source", "TNT Sports app", "HBO Max"):
        assert junk not in article.text


def test_body_selector_matching_nothing_is_an_error() -> None:
    html = _page("<p>Text of the page that is long enough to be an article body.</p>")

    with pytest.raises(ExtractionError, match="matched nothing"):
        extract_article(html, "https://example.com/a", ExtractRules(body="#missing"))


def test_page_without_text_is_an_error() -> None:
    with pytest.raises(ExtractionError, match="no article text"):
        extract_article(_page(""), "https://example.com/a", NO_RULES)


def test_charset_of_the_response_is_used() -> None:
    text = "Медведев победил Рублева в финале турнира в Ханчжоу, счёт 7:5, 6:4."
    html = f"<html><body><article><p>{text}</p></article></body></html>".encode("cp1251")

    article = extract_article(html, "https://example.com/a", NO_RULES, encoding="windows-1251")

    assert text in article.text


def test_find_embeds_recognises_the_usual_markup() -> None:
    instagram_frame = quote(
        '<blockquote class="instagram-media" '
        'data-instgrm-permalink="https://instagram.com/reel/AbC_1/?utm_source=ig_embed">'
    )
    tree = lxml.html.document_fromstring(
        "<html><body>"
        '<blockquote class="twitter-tweet"><p>Text</p>'
        '<a href="https://t.co/xyz">pic</a>'
        '<a href="https://twitter.com/atptour/status/123456789?ref_src=twsrc">May 1</a>'
        "</blockquote>"
        '<blockquote class="instagram-media" '
        'data-instgrm-permalink="https://www.instagram.com/p/XyZ-9/?utm_source=ig_embed">'
        "</blockquote>"
        '<iframe src="https://www.youtube-nocookie.com/embed/abcdefGHIJK?rel=0"></iframe>'
        '<iframe data-src="https://platform.twitter.com/embed/Tweet.html?id=987654321"></iframe>'
        f'<iframe src="data:text/html,{instagram_frame}"></iframe>'
        '<a data-component-name="Twitter2ToDOM" href="https://x.com/wta/status/555">x</a>'
        # Seen twice, kept once
        '<iframe src="https://www.youtube.com/embed/abcdefGHIJK"></iframe>'
        '<iframe src="https://maps.example.com/embed?q=court"></iframe>'
        "</body></html>"
    )

    assert find_embeds(tree) == (
        "https://x.com/i/status/123456789",
        "https://x.com/i/status/555",
        "https://www.instagram.com/p/XyZ-9/",
        "https://www.youtube.com/watch?v=abcdefGHIJK",
        "https://x.com/i/status/987654321",
        "https://www.instagram.com/reel/AbC_1/",
    )


@pytest.mark.parametrize(
    ("src", "expected"),
    [
        (
            "https://m.youtube.com/watch?v=abcdefGHIJK",
            "https://www.youtube.com/watch?v=abcdefGHIJK",
        ),
        (
            "https://youtube.com/watch?v=abcdefGHIJK&t=30",
            "https://www.youtube.com/watch?v=abcdefGHIJK",
        ),
        # Only youtube.com and its subdomains
        ("https://evilyoutube.com/watch?v=abcdefGHIJK", None),
        ("https://youtube.com.evil.org/watch?v=abcdefGHIJK", None),
        # The id goes into a URL as is, so it must look like one
        ("https://www.youtube.com/watch?v=abc#x", None),
        ("https://www.youtube.com/watch?v=abcdef%22onload", None),
    ],
)
def test_youtube_watch_links(src: str, expected: str | None) -> None:
    tree = lxml.html.document_fromstring(f'<html><body><iframe src="{src}"></iframe></body></html>')

    assert find_embeds(tree) == ((expected,) if expected else ())


def _page(body: str) -> bytes:
    return f"<html><head><title>T</title></head><body>{body}</body></html>".encode()
