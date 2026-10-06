"""Article page -> markdown text, metadata and embedded posts.

Generic extraction (trafilatura) for every source; a profile adds CSS selectors only where it
gets a site wrong. architecture/aggregator.md sections 4.3 and 4.4.
"""

import copy
import re
from dataclasses import dataclass
from urllib.parse import parse_qs, unquote, urlsplit

import lxml.html
import trafilatura
from lxml.etree import ParserError
from trafilatura.metadata import extract_metadata

from parsing.sources import ExtractRules


class ExtractionError(Exception):
    pass


@dataclass(frozen=True)
class Article:
    text: str
    lead: str | None
    author: str | None
    image_url: str | None
    canonical_url: str | None
    tags: tuple[str, ...]
    embeds: tuple[str, ...]


def extract_article(
    html: bytes, url: str, rules: ExtractRules, encoding: str | None = None
) -> Article:
    tree = _parse(html, encoding)
    meta = extract_metadata(copy.deepcopy(tree), default_url=url)
    embeds = find_embeds(tree)

    content = copy.deepcopy(tree)
    if rules.body:
        found = content.cssselect(rules.body)
        if not found:
            raise ExtractionError(f"body selector {rules.body!r} matched nothing")
        content = found[0]
    for selector in rules.drop:
        for element in content.cssselect(selector):
            element.drop_tree()

    text = trafilatura.extract(
        content,
        url=url,
        output_format="markdown",
        include_comments=False,
        include_tables=True,
        include_images=False,
        include_links=False,
        favor_precision=True,
    )
    if not text or not text.strip():
        raise ExtractionError("no article text found")
    return Article(
        text=text.strip(),
        lead=_clean(meta.description),
        author=_clean(meta.author),
        image_url=_clean(meta.image),
        canonical_url=_clean(meta.url),
        tags=tuple(dict.fromkeys([*(meta.categories or []), *(meta.tags or [])])),
        embeds=embeds,
    )


def _parse(html: bytes, encoding: str | None) -> lxml.html.HtmlElement:
    # The charset of the response wins over a <meta> in the page, as in a browser
    try:
        if encoding:
            try:
                parser = lxml.html.HTMLParser(encoding=encoding)
            except LookupError:
                return lxml.html.document_fromstring(html)
            return lxml.html.document_fromstring(html, parser=parser)
        return lxml.html.document_fromstring(html)
    except (ParserError, ValueError) as error:
        raise ExtractionError(f"unparsable page: {error}") from error


def _clean(value: str | None) -> str | None:
    value = (value or "").strip()
    return value or None


_STATUS = re.compile(
    r"^https?://(?:www\.|mobile\.)?(?:twitter|x)\.com/[^/?#]+(?:/web)?/status(?:es)?/(\d+)",
    re.IGNORECASE,
)
_INSTAGRAM = re.compile(r"^https?://(?:www\.)?instagram\.com/(p|reel|tv)/([\w-]+)", re.IGNORECASE)
_YOUTUBE = re.compile(
    r"^(?:https?:)?//(?:www\.)?(?:youtube(?:-nocookie)?\.com/(?:embed|shorts)/|youtu\.be/)"
    r"([\w-]{6,})",
    re.IGNORECASE,
)
_PERMALINK = re.compile(r'data-instgrm-permalink="([^"]+)"')


def find_embeds(tree: lxml.html.HtmlElement) -> tuple[str, ...]:
    """Posts embedded in the article, as canonical links: X, Instagram, YouTube."""
    candidates: list[str] = []
    candidates += _strings(tree.xpath("//blockquote[contains(@class, 'twitter-tweet')]//a/@href"))
    # Substack renders a tweet as a link with this component name
    candidates += _strings(tree.xpath("//a[contains(@data-component-name, 'Twitter')]/@href"))
    candidates += _strings(
        tree.xpath("//blockquote[contains(@class, 'instagram-media')]/@data-instgrm-permalink")
    )
    for src in _strings(tree.xpath("//iframe/@src | //iframe/@data-src")):
        if src.startswith("data:text/html"):
            # Substack puts the Instagram embed into the frame as encoded HTML
            candidates += _PERMALINK.findall(unquote(src))
        else:
            candidates.append(src)
    found = (_canonical_embed(candidate.strip()) for candidate in candidates)
    return tuple(dict.fromkeys(url for url in found if url))


def _canonical_embed(url: str) -> str | None:
    if match := _STATUS.match(url):
        return f"https://x.com/i/status/{match.group(1)}"
    if match := _INSTAGRAM.match(url):
        return f"https://www.instagram.com/{match.group(1).lower()}/{match.group(2)}/"
    if match := _YOUTUBE.match(url):
        return f"https://www.youtube.com/watch?v={match.group(1)}"
    parts = urlsplit(url)
    host = (parts.hostname or "").lower()
    if host == "platform.twitter.com" and "/embed/" in parts.path:
        tweet = parse_qs(parts.query).get("id", [""])[0]
        if tweet.isdigit():
            return f"https://x.com/i/status/{tweet}"
    if host.endswith("youtube.com") and parts.path == "/watch":
        video = parse_qs(parts.query).get("v", [""])[0]
        if video:
            return f"https://www.youtube.com/watch?v={video}"
    return None


def _strings(result: object) -> list[str]:
    return [str(value) for value in result] if isinstance(result, list) else []
