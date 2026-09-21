-- liquibase formatted sql
-- @formatter:off  (the IDE's SQL formatter realigns columns and rewrites untouched changesets)

-- =============================================
-- Discussion DB — Schema
-- Tennis Wire
--
-- New changeset at the end, next id. Editing an applied one changes its checksum, and
-- Liquibase then refuses to start against any database that ran it — same for renaming
-- the file. That matters from the first database nobody can drop; until then, editing
-- in place plus `down -v` is fine. Whitespace is exempt: Liquibase normalises it.
-- =============================================

-- changeset andrei:1
-- comment: Enable ltree extension for comment tree paths (uuidv7() is built into PG 18, no extension needed)
CREATE EXTENSION IF NOT EXISTS ltree;

-- changeset andrei:2
-- comment: Block render mode — closed set, validated by enum
CREATE TYPE block_mode AS ENUM ('soft', 'gravestone', 'subtree_removal');

-- changeset andrei:3
-- comment: Create comment table — adjacency list (in_reply_to_id) is the source of truth, ltree path is derived
CREATE TABLE comment (
                         id              UUID PRIMARY KEY DEFAULT uuidv7(),

    -- ltree label source: internal, monotonic, never exposed via the API
                         path_key        BIGINT GENERATED ALWAYS AS IDENTITY,

    -- Generic subject anchor — no FK, subject lives in another service
                         subject_type    TEXT NOT NULL,            -- 'publication' | 'match' | ... (open set, intentionally not an enum; the served set is discussion.subject-types)
                         subject_id      UUID NOT NULL,

    -- Tree structure
                         in_reply_to_id  UUID REFERENCES comment(id),   -- direct parent; SOURCE OF TRUTH
                         root_id         UUID NOT NULL REFERENCES comment(id),
                         path            LTREE NOT NULL,                -- DERIVED from in_reply_to_id via trigger

    -- Content
                         author_id       UUID NOT NULL,            -- references user in another service, no FK
                         body            TEXT NOT NULL,
                         reply_count     INTEGER NOT NULL DEFAULT 0,    -- raw direct-reply count, maintained in app layer (not viewer-relative)

                         deleted_at      TIMESTAMPTZ,              -- soft delete; body suppressed but node kept so children survive
                         created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                         updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

                         CONSTRAINT chk_comment_body_len CHECK (char_length(body) BETWEEN 1 AND 10000),
                         CONSTRAINT chk_comment_no_self_parent CHECK (in_reply_to_id <> id)
);

-- changeset andrei:4
-- comment: Indexes for comment — subtree by path (GiST), listing by subject, whole-thread by root, parent lookup
-- comment: idx_comment_top_level carries the keyset listing whole: the two subject columns pick the
-- comment: thread, the other two are its sort key, and the partial clause keeps replies out of an
-- comment: index only the top level is ever read through. idx_comment_subject stays for what counts
-- comment: a whole thread, replies included.
CREATE INDEX idx_comment_path ON comment USING GIST (path);
CREATE INDEX idx_comment_subject ON comment (subject_type, subject_id);
CREATE INDEX idx_comment_top_level ON comment (subject_type, subject_id, created_at, id)
    WHERE in_reply_to_id IS NULL;
CREATE INDEX idx_comment_root_id ON comment (root_id);
-- The sort key rides along so that paging a comment's direct replies is one index scan; the
-- leading column alone still answers the plain "who are this node's children" lookups.
CREATE INDEX idx_comment_in_reply_to ON comment (in_reply_to_id, created_at, id);

-- changeset andrei:5
-- comment: Create block table — peer-level, one-directional, mode chosen at block time (no DB default)
CREATE TABLE block (
                       blocker_id  UUID NOT NULL,
                       blocked_id  UUID NOT NULL,
                       mode        block_mode NOT NULL,
                       created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                       PRIMARY KEY (blocker_id, blocked_id),
                       CONSTRAINT chk_block_no_self CHECK (blocker_id <> blocked_id)
);

CREATE INDEX idx_block_blocked_id ON block (blocked_id);

-- changeset andrei:6 splitStatements:false
-- comment: Trigger — derive ltree path and root_id from in_reply_to_id on insert
-- rollback: DROP TRIGGER IF EXISTS trigger_comment_set_path ON comment; DROP FUNCTION IF EXISTS comment_set_path();
CREATE OR REPLACE FUNCTION comment_set_path()
RETURNS TRIGGER AS $$
DECLARE
parent_path  LTREE;
    parent_root  UUID;
BEGIN
    IF NEW.in_reply_to_id IS NULL THEN
        -- root comment: path is its own label, root_id points to itself
        NEW.path    = NEW.path_key::text::ltree;
        NEW.root_id = NEW.id;
    ELSE
        SELECT path, root_id INTO parent_path, parent_root
        FROM comment
        WHERE id = NEW.in_reply_to_id;

        IF parent_path IS NULL THEN
            RAISE EXCEPTION 'parent comment % not found', NEW.in_reply_to_id;
        END IF;

        NEW.path    = parent_path || NEW.path_key::text;
        NEW.root_id = parent_root;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_comment_set_path
    BEFORE INSERT ON comment
    FOR EACH ROW
    EXECUTE FUNCTION comment_set_path();

-- changeset andrei:7 splitStatements:false
-- comment: Trigger for auto-updating updated_at on comment, only when a body is written: reply_count
-- comment: bumps, soft-deletes and a body taken away do not pass for edits
-- rollback: DROP TRIGGER IF EXISTS trigger_comment_updated_at ON comment; DROP FUNCTION IF EXISTS update_updated_at_column();
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_comment_updated_at
    BEFORE UPDATE ON comment
    FOR EACH ROW
    WHEN (NEW.body IS NOT NULL AND OLD.body IS DISTINCT FROM NEW.body)
    EXECUTE FUNCTION update_updated_at_column();

-- changeset andrei:8
-- comment: Moderator-issued temporary restrictions on user capabilities (scoped for future extension)
CREATE TABLE user_restriction (
                                  id           UUID PRIMARY KEY DEFAULT uuidv7(),
                                  user_id      UUID NOT NULL,
                                  capability   TEXT NOT NULL DEFAULT 'comment',   -- open set; today always 'comment'
                                  expires_at   TIMESTAMPTZ,                        -- NULL = indefinite (still capability-scoped, not account-level)
                                  issued_by    UUID NOT NULL,                      -- moderator user id
                                  reason       TEXT,
                                  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_user_restriction_active ON user_restriction (user_id, capability, expires_at);

-- changeset andrei:9
-- comment: Complaints about a comment, one row each. The moderator's queue groups them by comment:
-- comment: the rules give him a card per comment, not per complaint.
-- comment: reporter_hash is an HMAC of (reporter, comment) under a server-side key, not a user id —
-- comment: it deduplicates without recording who complained. A plain digest would not: author ids are
-- comment: public on every comment, so the set to try is known.
-- comment: The hash is erased once the report is resolved, which is why chk_report_reporter only
-- comment: speaks about open rows.
CREATE TABLE report (
                        id             UUID PRIMARY KEY DEFAULT uuidv7(),

    -- Cascade because the erase flow deletes a departed author's childless comments outright;
    -- the surviving ones keep their reports and have them voided instead.
                        comment_id     UUID NOT NULL REFERENCES comment(id) ON DELETE CASCADE,

                        reporter_hash  BYTEA,                            -- NULL for the bot, and once resolved
                        source         TEXT NOT NULL DEFAULT 'user',     -- 'user' | 'bot'
                        reason         TEXT NOT NULL,                    -- open set, checked against a configured allowlist
                        created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

                        resolved_at    TIMESTAMPTZ,
                        resolved_by    UUID,                             -- NULL for 'voided' and 'expired': no moderator decides them
                        resolution     TEXT,                             -- 'hidden' | 'dismissed' | 'counted' | 'voided' | 'expired'

                        CONSTRAINT chk_report_source CHECK (source IN ('user', 'bot')),
                        CONSTRAINT chk_report_resolution CHECK (
                            resolution IS NULL OR resolution IN ('hidden', 'dismissed', 'counted', 'voided', 'expired')),
                        CONSTRAINT chk_report_resolved CHECK ((resolved_at IS NULL) = (resolution IS NULL)),
                        CONSTRAINT chk_report_reporter CHECK (
                            resolved_at IS NOT NULL OR (source = 'bot') = (reporter_hash IS NULL))
);

-- changeset andrei:10
-- comment: One open report per reporter and comment, and one open report per comment from the bot.
-- comment: Both scoped to open rows: a resolved report has no hash left to deduplicate on, and a
-- comment: comment edited after a moderator let it stand has to be reportable again.
-- comment: idx_report_open serves the queue itself — group the open rows by comment, oldest first.
CREATE UNIQUE INDEX uq_report_open_user ON report (comment_id, reporter_hash)
    WHERE source = 'user' AND resolved_at IS NULL;

CREATE UNIQUE INDEX uq_report_open_bot ON report (comment_id)
    WHERE source = 'bot' AND resolved_at IS NULL;

CREATE INDEX idx_report_open ON report (comment_id, created_at)
    WHERE resolved_at IS NULL;

-- changeset andrei:11
-- comment: How a comment left the thread, and when moderation last looked at it without removing it.
-- comment: deleted_at cannot carry either: the author's own delete and a removal by moderation write
-- comment: the same thing, while the rules keep them apart — a report is accepted on the first and
-- comment: refused on the second, and only the second counts against the author.
-- comment: reports_closed_at is compared against updated_at to decide whether a comment a moderator
-- comment: let stand has been edited since. That comparison holds because of changeset 7: the
-- comment: updated_at trigger fires on a body change only, so nothing written here can pass for an edit.
ALTER TABLE comment
    ADD COLUMN hidden_at         TIMESTAMPTZ,
    ADD COLUMN hidden_by         UUID,            -- NULL when the bot removed it: it has no profile
    ADD COLUMN hidden_source     TEXT,            -- 'moderator' | 'bot'
    ADD COLUMN reports_closed_at TIMESTAMPTZ,

    ADD CONSTRAINT chk_comment_hidden_source CHECK (
        hidden_source IS NULL OR hidden_source IN ('moderator', 'bot')),
    ADD CONSTRAINT chk_comment_hidden CHECK (
        (hidden_at IS NULL) = (hidden_source IS NULL)
        AND (hidden_source IS NULL OR (hidden_source = 'bot') = (hidden_by IS NULL)));

-- changeset andrei:12
-- comment: The queue card shows how many of the author's comments moderation has removed — over the
-- comment: last 30 days and in total, the bot's removals counted apart. Partial: removals are rare
-- comment: next to the comments themselves.
CREATE INDEX idx_comment_hidden_author ON comment (author_id, hidden_at)
    WHERE hidden_at IS NOT NULL;

-- changeset andrei:13
-- comment: Violation counted by hand on a comment its author deleted: not a removal, but it counts
-- comment: for the same total. Mutually exclusive with hidden_at — only an author-deleted comment
-- comment: can be counted, and moderation refuses to remove one of those.
-- comment: The index pairs with idx_comment_hidden_author: without it half the OR in the counter is
-- comment: unindexed, and comment has no index on author_id alone.
ALTER TABLE comment
    ADD COLUMN counted_at TIMESTAMPTZ,
    ADD CONSTRAINT chk_comment_counted CHECK (hidden_at IS NULL OR counted_at IS NULL);

CREATE INDEX idx_comment_counted_author ON comment (author_id, counted_at)
    WHERE counted_at IS NOT NULL;

-- changeset andrei:14
-- comment: A comment outlives the reader who wrote it. Erasing an account takes away what nothing
-- comment: stands on and leaves the rest as anonymous nodes, so the replies underneath survive:
-- comment: author_id goes, and the body goes with it — what the rules promise a departing reader is
-- comment: erasure, not concealment (discussion-rules §13.14, §11.23). Emptiness is confined to
-- comment: comments already taken down: one still standing has both. A body also goes on its own,
-- comment: thirty days after its comment was taken down (changeset 16).
ALTER TABLE comment
    ALTER COLUMN author_id DROP NOT NULL,
    ALTER COLUMN body DROP NOT NULL,
    DROP CONSTRAINT chk_comment_body_len;

ALTER TABLE comment
    ADD CONSTRAINT chk_comment_body_len CHECK (
        body IS NULL OR char_length(body) BETWEEN 1 AND 10000),
    ADD CONSTRAINT chk_comment_whole_while_standing CHECK (
        deleted_at IS NOT NULL OR (author_id IS NOT NULL AND body IS NOT NULL));

-- changeset andrei:15
-- comment: The key a client sends with a new comment, so that the same send repeated after an answer
-- comment: that never arrived finds the comment instead of writing a second one. Unique per author,
-- comment: not overall: the key is the client's and proves nothing about anyone else. Partial, since
-- comment: a comment sent without a key has no part in it. Nothing expires the key: it goes with the
-- comment: row, and an erase takes author_id away, after which the pair matches nothing.
ALTER TABLE comment ADD COLUMN idempotency_key UUID;

CREATE UNIQUE INDEX uq_comment_idempotency ON comment (author_id, idempotency_key)
    WHERE idempotency_key IS NOT NULL;

-- changeset andrei:16
-- comment: What the thirty-day wipe looks for: comments taken down that still carry text, oldest first.
-- comment: Partial, so it holds about a month's worth of taken-down comments rather than the whole table.
CREATE INDEX idx_comment_text_kept ON comment (deleted_at)
    WHERE deleted_at IS NOT NULL AND body IS NOT NULL;

-- changeset andrei:17
-- comment: The text as the reporter saw it, kept only once the author has rewritten the comment
-- comment: since the report (rules 10.19, 7.19). NULL means it still matches comment.body, so rows
-- comment: written before this column need no backfill: there was no edit for them to diverge from.
-- comment: Written by the edit rather than by the report, and erased together with reporter_hash
-- comment: when the card is closed - so no copy of a text outlives the terms of 8.20 and 13.14.
ALTER TABLE report ADD COLUMN body_at_report TEXT;

-- changeset andrei:18
-- comment: One row per person per comment per slot: 'vote' holds like or dislike, 'emoji' holds one
-- comment: of the configured keys. The two are independent, and a new value in a slot replaces the
-- comment: old one, which is what the unique index below is for. The emoji keys are NOT constrained
-- comment: here on purpose: the set is still being chosen, and adding one must stay a line of
-- comment: config rather than a migration. The service checks them against that config.
CREATE TABLE comment_reaction (
    id UUID PRIMARY KEY,
    comment_id UUID NOT NULL REFERENCES comment(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    slot TEXT NOT NULL,
    value TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_reaction_slot CHECK (slot IN ('vote', 'emoji')),
    CONSTRAINT chk_reaction_vote CHECK (slot <> 'vote' OR value IN ('like', 'dislike'))
);

CREATE UNIQUE INDEX uq_reaction_slot ON comment_reaction (comment_id, user_id, slot);

-- comment: Everything one person put anywhere: read when his account goes and when a permanent ban
-- comment: is issued with the reactions cleared.
CREATE INDEX idx_reaction_user ON comment_reaction (user_id);

-- changeset andrei:19
-- comment: Counts live on the comment rather than being read off the rows above, because the rows
-- comment: go when the comment does (rules 6.17) and the numbers have to outlive them. Emoji counts
-- comment: are one JSONB object, again so that a new key costs no migration: a key that is not
-- comment: there reads as zero, and the reply is built from the configured set, not from what the
-- comment: object happens to hold.
ALTER TABLE comment
    ADD COLUMN like_count INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN dislike_count INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN emoji_counts JSONB NOT NULL DEFAULT '{}',
    ADD COLUMN score INTEGER GENERATED ALWAYS AS (like_count - dislike_count) STORED;

-- comment: Read forward this orders top-level comments by score ascending and, on a tie, oldest
-- comment: first; read backward it gives score descending, newest first. The two sorts by score are
-- comment: the same index in opposite directions, which is why the tie-break follows the sort
-- comment: rather than always favouring the newer comment.
CREATE INDEX idx_comment_top_score ON comment (subject_type, subject_id, score, created_at, id)
    WHERE in_reply_to_id IS NULL;

-- changeset andrei:20
-- comment: What an author collected on comments that no longer exist. Filled when a comment stops
-- comment: being shown, from its own counts, which are zeroed in the same step so that a second
-- comment: removal adds nothing. His live comments are summed separately, so his standing is this
-- comment: row plus that sum, and neither counts anything twice.
CREATE TABLE author_reaction_total (
    author_id UUID PRIMARY KEY,
    like_count BIGINT NOT NULL DEFAULT 0,
    dislike_count BIGINT NOT NULL DEFAULT 0,
    emoji_counts JSONB NOT NULL DEFAULT '{}',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_author_total_not_negative CHECK (like_count >= 0 AND dislike_count >= 0)
);

-- changeset andrei:21
-- comment: One author's comments, read backward for newest first. Partial, and the listing asks for
-- comment: the same predicate: a comment that is down keeps deleted_at set whichever way it went
-- comment: down. The two indexes on author_id above are cut for the moderation counters.
CREATE INDEX idx_comment_author ON comment (author_id, created_at, id)
    WHERE deleted_at IS NULL;

-- changeset andrei:22
-- comment: A poll the editor drops into an article. The article holds only the id; the question,
-- comment: the options and the counts live here, next to the votes that make the counts. Who made
-- comment: it is the token's subject, not a reader id: an author need not have a reader profile.
-- comment: closes_at in the past is a closed poll; NULL is one that stays open.
CREATE TABLE poll (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    question TEXT NOT NULL,
    created_by UUID NOT NULL,
    closes_at TIMESTAMPTZ,
    vote_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_poll_vote_count CHECK (vote_count >= 0)
);

CREATE TABLE poll_option (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    poll_id UUID NOT NULL REFERENCES poll(id) ON DELETE CASCADE,
    position SMALLINT NOT NULL,
    text TEXT NOT NULL,
    vote_count INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT uq_poll_option_position UNIQUE (poll_id, position),
    CONSTRAINT chk_poll_option_vote_count CHECK (vote_count >= 0)
);

-- changeset andrei:23
-- comment: One vote per person per poll, replaceable and removable, as a reaction is. Read back only
-- comment: to mark the viewer's own choice and to take it off the counts when his account goes; the
-- comment: numbers people see are the counts on the poll and its options.
CREATE TABLE poll_vote (
    poll_id UUID NOT NULL REFERENCES poll(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    option_id UUID NOT NULL REFERENCES poll_option(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (poll_id, user_id)
);

CREATE INDEX idx_poll_vote_user ON poll_vote (user_id);
