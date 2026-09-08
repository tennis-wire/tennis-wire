-- liquibase formatted sql

-- =============================================
-- Discussion DB — Initial Schema
-- Tennis Wire
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
    subject_type    TEXT NOT NULL,            -- 'article' | 'forum_topic' | ... (open set, intentionally not an enum)
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
CREATE INDEX idx_comment_path ON comment USING GIST (path);
CREATE INDEX idx_comment_subject ON comment (subject_type, subject_id);
CREATE INDEX idx_comment_root_id ON comment (root_id);
CREATE INDEX idx_comment_in_reply_to ON comment (in_reply_to_id);

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
-- comment: Trigger for auto-updating updated_at on comment — only when the body actually changes,
-- comment: so reply_count bumps and soft-deletes do not masquerade as edits
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
    WHEN (OLD.body IS DISTINCT FROM NEW.body)
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
