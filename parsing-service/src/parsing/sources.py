"""Source profiles: where and how to collect, and what to take.

architecture/aggregator.md section 4.2. In part 2 the file seeds the aggregator's registry.
"""

import re
from datetime import timedelta
from pathlib import Path
from typing import Literal, Self

import yaml
from pydantic import BaseModel, ConfigDict, Field, HttpUrl, field_validator, model_validator

from parsing.urls import host_allowed

# The scheduler ticks once a minute
MIN_INTERVAL = timedelta(minutes=1)


class ExtractRules(BaseModel):
    """CSS selectors for a source whose pages the generic extraction gets wrong."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    body: str | None = None
    drop: tuple[str, ...] = ()
    # Promos and "read also" lines written into the body as ordinary paragraphs: CSS cannot
    # tell them apart, their text can
    paragraph: str = "p"
    drop_paragraphs: tuple[re.Pattern[str], ...] = ()
    # An element whose datetime attribute is the publication time, where the page has a precise
    # one and the feed has none (an HTML list page)
    published: str | None = None


class ListingRules(BaseModel):
    """Selectors for a list page (kind: html)."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    # One entry of the list; without it every link matching `link` on the page is an entry
    item: str | None = None
    # The link to the article, inside the item when there is one
    link: str
    # The title inside the item; the link text otherwise
    title: str | None = None
    # An attribute of the link that holds the lead
    lead_attr: str | None = None


class SourceProfile(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    key: str = Field(pattern=r"^[a-z0-9]+(-[a-z0-9]+)*$")
    name: str
    kind: Literal["rss", "news_sitemap", "html"]
    url: HttpUrl
    hosts: tuple[str, ...] = Field(min_length=1)
    language: str = Field(pattern=r"^[a-z]{2,3}$")
    content_mode: Literal["full", "lead"] = "full"
    include: tuple[re.Pattern[str], ...] = ()
    exclude: tuple[re.Pattern[str], ...] = ()
    interval: timedelta
    # Longer than this without a new item, and the source counts as gone quiet
    quiet_after: timedelta = timedelta(days=1)
    respect_robots: bool = True
    extract: ExtractRules = ExtractRules()
    listing: ListingRules | None = None
    enabled: bool = True

    @field_validator("hosts")
    @classmethod
    def _normalise_hosts(cls, hosts: tuple[str, ...]) -> tuple[str, ...]:
        return tuple(host.strip().rstrip(".").lower() for host in hosts)

    @model_validator(mode="after")
    def _check(self) -> Self:
        if not host_allowed(str(self.url), self.hosts):
            raise ValueError(f"{self.key}: url is outside hosts")
        if self.interval < MIN_INTERVAL:
            raise ValueError(f"{self.key}: interval is shorter than {MIN_INTERVAL}")
        if (self.kind == "html") != (self.listing is not None):
            raise ValueError(f"{self.key}: listing goes with kind html, and only with it")
        return self

    def wants(self, url: str) -> bool:
        """Whether the include and exclude patterns let the URL through."""
        if self.include and not any(pattern.search(url) for pattern in self.include):
            return False
        return not any(pattern.search(url) for pattern in self.exclude)


class SourceFile(BaseModel):
    model_config = ConfigDict(extra="forbid")

    sources: list[SourceProfile]


def load_sources(path: Path) -> dict[str, SourceProfile]:
    """Profiles by key. Read on every scheduler tick, so an edit applies without a restart."""
    parsed = SourceFile.model_validate(yaml.safe_load(path.read_text(encoding="utf-8")))
    profiles: dict[str, SourceProfile] = {}
    for profile in parsed.sources:
        if profile.key in profiles:
            raise ValueError(f"Duplicate source key {profile.key}")
        profiles[profile.key] = profile
    return profiles
