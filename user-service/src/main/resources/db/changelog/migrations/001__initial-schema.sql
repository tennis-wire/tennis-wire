-- liquibase formatted sql

-- =============================================
-- User DB - Initial Schema
-- Tennis Wire
-- =============================================

-- changeset andrei:1
-- comment: Reader profile. Everything the public sees about a person lives here; Keycloak keeps
-- comment: only identity. gen_random_uuid() rather than uuidv7(): user_id is returned with every
-- comment: comment, and a time-ordered id would publish the account creation date (readers.md §1.4).
CREATE TABLE profile
(
    user_id             UUID PRIMARY KEY     DEFAULT gen_random_uuid(),
    display_name        TEXT        NOT NULL,
    display_name_chosen BOOLEAN     NOT NULL DEFAULT FALSE,
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
CREATE TABLE identity_link
(
    provider   TEXT        NOT NULL,
    sub        TEXT        NOT NULL,
    user_id    UUID        NOT NULL REFERENCES profile (user_id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (provider, sub)
);

-- changeset andrei:4
-- comment: Reverse lookup: given a user_id, find the subjects to remove from Keycloak
CREATE INDEX idx_identity_link_user ON identity_link (user_id);

-- changeset andrei:5 splitStatements:false
-- comment: Keep updated_at honest in the database rather than trusting every write path
-- rollback: DROP TRIGGER IF EXISTS trigger_profile_updated_at ON profile; DROP FUNCTION IF EXISTS update_updated_at_column();
CREATE
OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at
= NOW();
RETURN NEW;
END;
$$
LANGUAGE plpgsql;

CREATE TRIGGER trigger_profile_updated_at
    BEFORE UPDATE
    ON profile
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- changeset andrei:6
-- comment: An account on its way out. The request records it here and shuts the identity down; the
-- comment: rest runs from a job, because an access token handed out a moment earlier has to be
-- comment: outwaited and another service has to be reached on the way (readers.md §1.6).
-- comment: subject is kept here rather than read back from identity_link: the profile goes, and the
-- comment: links with it, long before the Keycloak account does when a ban holds the address.
CREATE TABLE pending_identity_delete
(
    user_id            UUID PRIMARY KEY,
    subject            TEXT        NOT NULL,
    requested_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- When the account was disabled and stripped. The wait counts from here and not from the
    -- request: until this is set, nothing has been closed and there is nothing to outwait.
    identity_closed_at TIMESTAMPTZ,
    trace_erased_at    TIMESTAMPTZ,

    -- A ban outlives the account, or deleting one would free the address and shed it
    -- (discussion-rules §12.20). Held with no date is a ban with no end: never freed.
    address_held       BOOLEAN     NOT NULL DEFAULT FALSE,
    address_held_until TIMESTAMPTZ,

    attempts           INTEGER     NOT NULL DEFAULT 0,
    last_attempt_at    TIMESTAMPTZ,
    last_error         TEXT,

    CONSTRAINT chk_pending_hold CHECK (address_held OR address_held_until IS NULL)
);

-- changeset andrei:7
-- comment: A name a departed reader used, kept out of circulation for a while after his profile has
-- comment: gone (discussion-rules.md §13.17). The profile row itself cannot be what holds it: that
-- comment: would mean keeping his user_id and everything else about him for the same month.
CREATE TABLE display_name_reservation
(
    name_lower     TEXT PRIMARY KEY,
    reserved_until TIMESTAMPTZ NOT NULL
);

-- changeset andrei:8 splitStatements:false
-- comment: Enforced here rather than in the service, so that no write path can miss it: uniqueness
-- comment: of display names already lives in the database, and this is the same rule over a second
-- comment: table. Raised as a unique violation because that is what it is to a caller - both the
-- comment: rename, which reports the name as taken, and the stub generator, which tries another.
-- rollback: DROP TRIGGER IF EXISTS trigger_profile_reject_reserved_name ON profile; DROP FUNCTION IF EXISTS profile_reject_reserved_name();
CREATE
OR REPLACE FUNCTION profile_reject_reserved_name()
RETURNS TRIGGER AS $$
BEGIN
    -- A rename that does not change the name, and every touch that merely rewrites the row, are
    -- nobody's business here.
    IF
TG_OP = 'UPDATE' AND LOWER(NEW.display_name) = LOWER(OLD.display_name) THEN
        RETURN NEW;
END IF;

    IF
EXISTS (SELECT 1
               FROM display_name_reservation
               WHERE name_lower = LOWER(NEW.display_name)
                 AND reserved_until > NOW()) THEN
        RAISE EXCEPTION 'display name % is still reserved', NEW.display_name
            USING ERRCODE = 'unique_violation';
END IF;

RETURN NEW;
END;
$$
LANGUAGE plpgsql;

CREATE TRIGGER trigger_profile_reject_reserved_name
    BEFORE INSERT OR
UPDATE OF display_name
ON profile
    FOR EACH ROW
    EXECUTE FUNCTION profile_reject_reserved_name();

-- changeset andrei:9
-- comment: When this account is worth looking at again. The wait itself is worked out in the job -
-- comment: an address a ban holds is asked about on a cadence, one that keeps failing is asked about
-- comment: less and less - and only the answer is kept here, so that a row waiting is invisible to
-- comment: the query rather than picked up and put down again. Without it, accounts that are never
-- comment: finished at all - a ban with no end holds its address for good - fill the page the job
-- comment: reads and nothing new is ever reached. NULL means it has not been looked at yet.
ALTER TABLE pending_identity_delete
    ADD COLUMN retry_after TIMESTAMPTZ;

CREATE INDEX idx_pending_identity_delete_due
    ON pending_identity_delete (COALESCE(retry_after, requested_at));
