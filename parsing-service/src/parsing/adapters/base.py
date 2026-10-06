"""What every adapter gives the pipeline: the entries of one source's feed."""

from dataclasses import dataclass
from datetime import datetime
from typing import Protocol

from parsing.sources import SourceProfile


class FeedError(Exception):
    """The feed could not be read at all."""


@dataclass(frozen=True)
class FeedEntry:
    url: str
    # Stable id from the feed (RSS guid); None when the feed has none
    external_id: str | None
    title: str
    published_at: datetime | None
    lead: str | None
    author: str | None
    categories: tuple[str, ...]


class Adapter(Protocol):
    def __call__(self, body: bytes, profile: SourceProfile) -> list[FeedEntry]: ...
