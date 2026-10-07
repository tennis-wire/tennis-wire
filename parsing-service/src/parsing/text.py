"""Small text helpers."""

import re

import lxml.html
from lxml.etree import ParserError

_SPACES = re.compile(r"\s+")


def html_to_text(fragment: str | None) -> str | None:
    """Plain text of an HTML fragment such as a feed summary; None when nothing is left."""
    if not fragment or not fragment.strip():
        return None
    try:
        text = lxml.html.fragment_fromstring(fragment, create_parent="div").text_content()
    except ParserError:
        text = fragment
    text = _SPACES.sub(" ", text).strip()
    return text or None


# A charset declared in the page itself: <meta charset> or the http-equiv form
_META_CHARSET = re.compile(rb"<meta[^>]+charset\s*=", re.IGNORECASE)


def parse_html(body: bytes, encoding: str | None = None) -> lxml.html.HtmlElement:
    """A page as a tree. The response's charset wins, as in a browser; then the page's <meta>;
    then UTF-8. Left to itself, lxml reads a page without <meta> as Latin-1.

    Raises ParserError or ValueError for a page that cannot be parsed at all.
    """
    if encoding:
        try:
            return lxml.html.document_fromstring(
                body, parser=lxml.html.HTMLParser(encoding=encoding)
            )
        except LookupError:
            pass
    if not _META_CHARSET.search(body[:4096]):
        try:
            return lxml.html.document_fromstring(body.decode("utf-8"))
        except (UnicodeDecodeError, ValueError):
            pass
    return lxml.html.document_fromstring(body)
