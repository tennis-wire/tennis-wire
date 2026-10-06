"""Where results go. Part 1: local files for checking sources (architecture/aggregator.md 4.9).

The aggregator becomes another Sink in part 2.
"""

import asyncio
import gzip
import threading
from pathlib import Path
from typing import Protocol

from pydantic import BaseModel

from parsing.models import Item, ItemChange, RunReport
from parsing.urls import url_digest


class Sink(Protocol):
    async def item(self, item: Item, html: bytes | None) -> None: ...

    async def change(self, change: ItemChange) -> None: ...

    async def run(self, report: RunReport) -> None: ...


class FileSink:
    """items-<date>.jsonl, changes.jsonl, runs.jsonl and html/<source>/<digest>.html.gz."""

    def __init__(self, root: Path) -> None:
        self._root = root
        # Jobs of one worker append to the same files
        self._lock = threading.Lock()

    async def item(self, item: Item, html: bytes | None) -> None:
        await asyncio.to_thread(self._write_item, item, html)

    async def change(self, change: ItemChange) -> None:
        await asyncio.to_thread(self._append, "changes.jsonl", change)

    async def run(self, report: RunReport) -> None:
        await asyncio.to_thread(self._append, "runs.jsonl", report)

    def _write_item(self, item: Item, html: bytes | None) -> None:
        if html is not None:
            path = self._root / "html" / item.source / f"{url_digest(item.url)}.html.gz"
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(gzip.compress(html))
        self._append(f"items-{item.first_seen_at.date().isoformat()}.jsonl", item)

    def _append(self, name: str, record: BaseModel) -> None:
        line = record.model_dump_json() + "\n"
        with self._lock:
            self._root.mkdir(parents=True, exist_ok=True)
            with (self._root / name).open("a", encoding="utf-8") as file:
                file.write(line)
