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
