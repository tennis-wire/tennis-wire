from pathlib import Path

import pytest
from pydantic import ValidationError

from parsing.sources import load_sources
from tests.conftest import ProfileFactory

REPO_SOURCES = Path(__file__).parent.parent / "sources.yaml"


def test_the_committed_sources_file_loads() -> None:
    sources = load_sources(REPO_SOURCES)

    assert {"tennis-majors", "bounces", "tnt-sports", "eurosport-es"} <= sources.keys()
    # Eurosport editions share one set of extraction rules through a YAML anchor
    assert sources["eurosport-fr"].extract == sources["tnt-sports"].extract
    assert all(profile.enabled for profile in sources.values())


def test_hosts_are_normalised(make_profile: ProfileFactory) -> None:
    profile = make_profile(hosts=["Example.COM."])

    assert profile.hosts == ("example.com",)


def test_feed_outside_hosts_is_refused(make_profile: ProfileFactory) -> None:
    with pytest.raises(ValidationError, match="outside hosts"):
        make_profile(url="https://feeds.other.org/rss")


def test_interval_below_a_minute_is_refused(make_profile: ProfileFactory) -> None:
    with pytest.raises(ValidationError, match="interval"):
        make_profile(interval="PT30S")


def test_unknown_field_is_refused(make_profile: ProfileFactory) -> None:
    with pytest.raises(ValidationError):
        make_profile(intervall="PT1M")


def test_include_and_exclude(make_profile: ProfileFactory) -> None:
    profile = make_profile(include=["/tennis/"], exclude=[r"_vid\d+"])

    assert profile.wants("https://example.com/tennis/story_sto1.shtml")
    assert not profile.wants("https://example.com/football/story_sto1.shtml")
    assert not profile.wants("https://example.com/tennis/clip_vid60101794/video.shtml")


def test_duplicate_keys_are_refused(tmp_path: Path) -> None:
    source = """
  - key: same
    name: A
    kind: rss
    url: https://example.com/feed
    hosts: [example.com]
    language: en
    interval: PT1M
"""
    path = tmp_path / "sources.yaml"
    path.write_text("sources:" + source + source, encoding="utf-8")

    with pytest.raises(ValueError, match="Duplicate source key same"):
        load_sources(path)
