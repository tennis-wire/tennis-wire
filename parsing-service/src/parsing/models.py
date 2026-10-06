"""What the collector produces: news items, changes of seen ones, run reports.

The item is what the aggregator will take in part 2 (architecture/aggregator.md section 4.4).
"""

from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel


class ExtractionStatus(StrEnum):
    OK = "ok"
    # The page could not be had or read; the lead from the feed stays
    FAILED = "failed"
    # Not attempted: a lead-only source, or robots.txt
    SKIPPED = "skipped"


class Item(BaseModel):
    source: str
    external_id: str
    url: str
    title: str
    lead: str | None = None
    # Markdown
    text: str | None = None
    author: str | None = None
    image_url: str | None = None
    published_at: datetime | None = None
    first_seen_at: datetime
    language: str
    categories: list[str] = []
    embeds: list[str] = []
    extraction: ExtractionStatus
    extraction_error: str | None = None


class ItemChange(BaseModel):
    """A seen article whose title or date changed in the feed. Recorded, not fetched again."""

    source: str
    url: str
    seen_at: datetime
    title_before: str
    title: str
    published_before: datetime | None
    published: datetime | None


class BlockKind(StrEnum):
    FORBIDDEN = "forbidden"
    TOO_MANY_REQUESTS = "too_many_requests"
    LEGAL = "legal"
    CHALLENGE = "challenge"
    CAPTCHA = "captcha"
    CONSENT = "consent"


class Block(BaseModel):
    """How a site refused us: the decision on what to do next depends on it."""

    kind: BlockKind
    http_status: int
    url: str
    retry_after_seconds: int | None = None
    detail: str | None = None


class RunStatus(StrEnum):
    OK = "ok"
    NOT_MODIFIED = "not_modified"
    BLOCKED = "blocked"
    ROBOTS = "robots"
    FAILED = "failed"


class RunReport(BaseModel):
    source: str
    started_at: datetime
    finished_at: datetime | None = None
    status: RunStatus = RunStatus.OK
    http_status: int | None = None
    entries: int = 0
    new: int = 0
    changed: int = 0
    extraction_failed: int = 0
    block: Block | None = None
    error: str | None = None
