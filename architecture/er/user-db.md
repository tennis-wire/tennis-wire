# User DB - ER diagram

Schema: `user-service/src/main/resources/db/changelog/migrations/001__initial-schema.sql`

```mermaid
erDiagram
    profile ||--o{ identity_link : "user_id"

    profile {
        uuid user_id PK "random, not time-ordered"
        text display_name UK "case-insensitive"
        bool display_name_chosen
        timestamptz created_at
        timestamptz updated_at "set by trigger"
    }

    identity_link {
        text provider PK
        text sub PK "subject at the provider"
        uuid user_id FK
        timestamptz created_at
    }

    pending_identity_delete {
        uuid user_id PK
        text subject
        timestamptz requested_at
        timestamptz identity_closed_at
        timestamptz trace_erased_at
        bool address_held
        timestamptz address_held_until "null while held means for good"
        int attempts
        timestamptz last_attempt_at
        text last_error
        timestamptz retry_after
    }

    display_name_reservation {
        text name_lower PK
        timestamptz reserved_until
    }
```

`identity_link` is the only FK, cascading on delete from `profile`.
`pending_identity_delete` and `display_name_reservation` outlive the profile
row on purpose and reference nothing: the first carries an erasure through
to the end, the second keeps a departed reader's name out of circulation.
A trigger on `profile` refuses a name that is still reserved.
