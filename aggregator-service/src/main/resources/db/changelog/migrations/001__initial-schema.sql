-- liquibase formatted sql

-- =============================================
-- Aggregator DB - Initial Schema
-- Tennis Wire
-- architecture/aggregator.md 5.1
-- =============================================

-- changeset andrei:1
-- comment: The catalog of sources. How each is collected lives in the collector's sources.yaml; this
-- comment: is what the newsroom sees of it. The collector writes it: the whole list on start and on
-- comment: change, a source gone from the list is retired and its items live out their term.
CREATE TABLE source
(
    key        TEXT PRIMARY KEY,
    name       TEXT        NOT NULL,
    language   TEXT        NOT NULL,
    site_url   TEXT        NOT NULL,
    retired    BOOLEAN     NOT NULL DEFAULT FALSE,
    -- Set by the newsroom (part 3): out of the feed, while the collector goes on
    hidden     BOOLEAN     NOT NULL DEFAULT FALSE,
    -- The collector's latest health snapshot (aggregator.md 4.11), kept as it came
    health     JSONB,
    health_at  TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- changeset andrei:2
-- comment: A news item, its current state: no versions, the collector does not read an article twice.
-- comment: One article, one row: the canonical URL is the key. A second source sending the same
-- comment: address updates the row and leaves it with the first. created_at is when it arrived here,
-- comment: and the term counts from it.
CREATE TABLE item
(
    id               UUID PRIMARY KEY     DEFAULT gen_random_uuid(),
    url              TEXT        NOT NULL,
    source_key       TEXT        NOT NULL REFERENCES source (key),
    external_id      TEXT        NOT NULL,
    title            TEXT        NOT NULL,
    -- The title before the source changed it, so the newsroom sees the item was corrected
    title_before     TEXT,
    lead             TEXT,
    -- Markdown
    text             TEXT,
    author           TEXT,
    image_url        TEXT,
    published_at     TIMESTAMPTZ,
    first_seen_at    TIMESTAMPTZ NOT NULL,
    language         TEXT        NOT NULL,
    categories       TEXT[]      NOT NULL DEFAULT '{}',
    embeds           TEXT[]      NOT NULL DEFAULT '{}',
    extraction       TEXT        NOT NULL CHECK (extraction IN ('ok', 'failed', 'skipped')),
    extraction_error TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_item_url UNIQUE (url)
);

-- changeset andrei:3
-- comment: The expiry job walks items by arrival
CREATE INDEX idx_item_created_at ON item (created_at);

-- changeset andrei:4 splitStatements:false
-- comment: Keep updated_at honest in the database rather than trusting every write path
-- rollback: DROP TRIGGER IF EXISTS trigger_item_updated_at ON item; DROP TRIGGER IF EXISTS trigger_source_updated_at ON source; DROP FUNCTION IF EXISTS update_updated_at_column();
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_source_updated_at
    BEFORE UPDATE ON source
    FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_item_updated_at
    BEFORE UPDATE ON item
    FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
