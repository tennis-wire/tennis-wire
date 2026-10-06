"""Adapters by source kind: architecture/aggregator.md section 4.5."""

from parsing.adapters.base import Adapter, FeedEntry, FeedError
from parsing.adapters.rss import parse_rss

ADAPTERS: dict[str, Adapter] = {
    "rss": parse_rss,
}

__all__ = ["ADAPTERS", "Adapter", "FeedEntry", "FeedError"]
