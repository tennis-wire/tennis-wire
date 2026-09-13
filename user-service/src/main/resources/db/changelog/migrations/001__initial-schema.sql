-- liquibase formatted sql

-- =============================================
-- User DB — Initial Schema
-- Tennis Wire
-- =============================================

-- changeset andrei:1
-- comment: Reader profile. Everything the public sees about a person lives here; Keycloak keeps
-- comment: only identity. gen_random_uuid() rather than uuidv7(): user_id is returned with every
-- comment: comment, and a time-ordered id would publish the account creation date (readers.md §1.4).
CREATE TABLE profile (
                         user_id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                         display_name        TEXT NOT NULL,
                         display_name_chosen BOOLEAN NOT NULL DEFAULT FALSE,
                         created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                         updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- changeset andrei:2
-- comment: Display names are unique case-insensitively. Generated stubs share this namespace with
-- comment: chosen names, so the generator has to survive a collision rather than assume uniqueness.
CREATE UNIQUE INDEX uq_profile_display_name ON profile (LOWER(display_name));

-- changeset andrei:3
-- comment: Maps an identity provider subject to the platform user_id. Written once and never updated:
-- comment: that immutability is what lets consumers cache sub -> user_id with no TTL (readers.md §1.3).
-- comment: ON DELETE CASCADE so that erasing a profile takes its links with it.
CREATE TABLE identity_link (
                               provider    TEXT NOT NULL,
                               sub         TEXT NOT NULL,
                               user_id     UUID NOT NULL REFERENCES profile(user_id) ON DELETE CASCADE,
                               created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                               PRIMARY KEY (provider, sub)
);

-- changeset andrei:4
-- comment: Reverse lookup: given a user_id, find the subjects to remove from Keycloak
CREATE INDEX idx_identity_link_user ON identity_link (user_id);

-- changeset andrei:5 splitStatements:false
-- comment: Keep updated_at honest in the database rather than trusting every write path
-- rollback: DROP TRIGGER IF EXISTS trigger_profile_updated_at ON profile; DROP FUNCTION IF EXISTS update_updated_at_column();
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_profile_updated_at
    BEFORE UPDATE ON profile
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- changeset andrei:6
-- comment: An account on its way out. The request records it here and shuts the identity down; the
-- comment: rest runs from a job, because an access token handed out a moment earlier has to be
-- comment: outwaited and another service has to be reached on the way (readers.md §1.6).
-- comment: subject is kept here rather than read back from identity_link: the profile goes, and the
-- comment: links with it, long before the Keycloak account does when a ban holds the address.
CREATE TABLE pending_identity_delete (
                                         user_id            UUID PRIMARY KEY,
                                         subject            TEXT NOT NULL,
                                         requested_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- When the account was disabled and stripped. The wait counts from here and not from the
    -- request: until this is set, nothing has been closed and there is nothing to outwait.
                                         identity_closed_at TIMESTAMPTZ,
                                         trace_erased_at    TIMESTAMPTZ,

    -- A ban outlives the account, or deleting one would free the address and shed it
    -- (discussion-rules §12.20). Held with no date is a ban with no end: never freed.
                                         address_held       BOOLEAN NOT NULL DEFAULT FALSE,
                                         address_held_until TIMESTAMPTZ,

                                         attempts           INTEGER NOT NULL DEFAULT 0,
                                         last_attempt_at    TIMESTAMPTZ,
                                         last_error         TEXT,

                                         CONSTRAINT chk_pending_hold CHECK (address_held OR address_held_until IS NULL)
);
