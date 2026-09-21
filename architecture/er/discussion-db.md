# Discussion DB - ER diagram

Schema: `discussion-service/src/main/resources/db/changelog/migrations/001__initial-schema.sql`

```mermaid
erDiagram
    comment |o--o{ comment : "in_reply_to_id"
    comment ||--|{ comment : "root_id"
    comment ||--o{ report : "comment_id"
    comment ||--o{ comment_reaction : "comment_id"

    comment {
        uuid id PK "uuidv7"
        bigint path_key "identity, source of ltree labels"
        text subject_type "publication, match, ... open set"
        uuid subject_id "subject outside this DB, no FK"
        uuid in_reply_to_id FK "direct parent, source of truth"
        uuid root_id FK "set by trigger"
        ltree path "set by trigger"
        uuid author_id "null once the author is erased"
        text body "null once erased or 30 days after takedown"
        int reply_count "raw direct replies"
        timestamptz deleted_at "set on any takedown"
        timestamptz hidden_at "taken down by moderation"
        uuid hidden_by "null for the bot"
        text hidden_source "moderator | bot"
        timestamptz reports_closed_at
        timestamptz counted_at "violation counted by hand"
        uuid idempotency_key "unique per author"
        int like_count
        int dislike_count
        jsonb emoji_counts
        int score "generated: likes minus dislikes"
        timestamptz created_at
        timestamptz updated_at "bumped on a body change only"
    }

    block {
        uuid blocker_id PK
        uuid blocked_id PK
        block_mode mode "soft | gravestone | subtree_removal"
        timestamptz created_at
    }

    user_restriction {
        uuid id PK
        uuid user_id
        text capability "open set, today comment"
        timestamptz expires_at "null means indefinite"
        uuid issued_by "moderator"
        text reason
        timestamptz created_at
    }

    report {
        uuid id PK
        uuid comment_id FK
        bytea reporter_hash "HMAC, null for the bot and once resolved"
        text source "user | bot"
        text reason
        text body_at_report "kept only if edited since the report"
        timestamptz created_at
        timestamptz resolved_at
        uuid resolved_by
        text resolution "hidden | dismissed | counted | voided | expired"
    }

    comment_reaction {
        uuid id PK
        uuid comment_id FK
        uuid user_id
        text slot "vote | emoji"
        text value "like | dislike, or an emoji key"
        timestamptz created_at
    }

    author_reaction_total {
        uuid author_id PK
        bigint like_count
        bigint dislike_count
        jsonb emoji_counts
        timestamptz updated_at
    }
```

`comment` is an adjacency list: `in_reply_to_id` is the source of truth,
`path` and `root_id` are derived from it by a trigger on insert; a root
comment has no parent and is its own root. User ids (`author_id`, `user_id`,
`blocker_id`, `blocked_id`, `issued_by`, `hidden_by`, `resolved_by`) and
`subject_id` point outside this database and carry no FK. `report` and
`comment_reaction` cascade on delete from `comment`; `author_reaction_total`
keeps what an author collected on comments no longer shown.
