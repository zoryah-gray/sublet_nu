# SubletNU — Entity Relationship Diagram

Reflects `schema.sql` as of 09/07/26. Reference only — no live database yet
(see `schema.sql`'s own header and `.claude/plans/PLAN.md` for the Day 2 vs.
Day 3 split).

```mermaid
erDiagram
    users ||--o{ sublets : owns
    users |o--o{ sublets : "confirmed renter of (optional)"
    sublets ||--o{ sublet_quarters : has
    sublets ||--o{ sublet_images : has
    sublets ||--o{ sublet_videos : has
    users ||--o{ favorites : favorites
    sublets ||--o{ favorites : "favorited by"
    sublets ||--o{ match_requests : receives
    users ||--o{ match_requests : "sends (requester)"
    users ||--o{ match_requests : "owns (denormalized owner_id)"
    match_requests |o--o| message_threads : opens
    message_threads ||--o{ messages : contains
    users ||--o{ messages : sends
    messages ||--o{ message_media : has
    message_threads ||--o{ thread_read_state : "watermarked by"
    users ||--o{ thread_read_state : reads
    users ||--o{ notifications : receives

    users {
        uuid id PK
        text email UK
        boolean is_public
        timestamptz deleted_at "soft delete"
    }
    sublets {
        uuid id PK
        uuid owner_id FK
        uuid confirmed_renter_id FK "nullable"
        text display_status "public/restricted/private/deleted"
        boolean is_draft
        timestamptz deleted_at "soft delete"
    }
    sublet_quarters {
        uuid sublet_id PK, FK
        quarter quarter PK
    }
    sublet_images {
        uuid id PK
        uuid sublet_id FK
        smallint position "0 = featured"
    }
    sublet_videos {
        uuid id PK
        uuid sublet_id FK
        smallint position
    }
    favorites {
        uuid user_id PK, FK
        uuid sublet_id PK, FK
    }
    match_requests {
        uuid id PK
        uuid sublet_id FK
        uuid owner_id FK "denormalized"
        uuid requester_id FK
        uuid thread_id FK "nullable, added via ALTER TABLE"
        text status "pending/accepted/confirmed/declined/cancelled/listing_removed"
        timestamptz last_transitioned_at
    }
    message_threads {
        uuid id PK
        uuid match_request_id FK, UK "1:1 with match_requests"
    }
    messages {
        uuid id PK
        uuid thread_id FK
        uuid sender_id FK
    }
    message_media {
        uuid id PK
        uuid message_id FK
        text type "image/video"
        smallint position
    }
    thread_read_state {
        uuid thread_id PK, FK
        uuid user_id PK
        timestamptz last_read_at
    }
    notifications {
        uuid id PK
        uuid user_id FK
        text type
        text subject_type "match_request/sublet/thread"
        uuid subject_id "polymorphic, no FK"
        jsonb payload
    }
```

## Notes the diagram can't fully express

- **`ON DELETE` policy**: every FK above is `RESTRICT` except `favorites`
  (both FKs `CASCADE`) — see `schema.sql`'s header comment for why favorites
  is the one deliberate exception.
- **`sublets.confirmed_renter_id`** is nullable and only meaningful when
  `display_status = 'restricted'` — it's what makes `'restricted'`
  ("visible to owner + confirmed renter only") different from `'private'`
  ("visible to owner only").
- **`match_requests.thread_id` ↔ `message_threads.match_request_id`** is a
  circular reference. `schema.sql` creates `match_requests.thread_id` as a
  plain nullable column with no inline FK, creates `message_threads`
  afterward, then adds `match_requests`' FK via a separate `ALTER TABLE`.
  The diagram shows the logical 1:1 relationship; the physical creation
  order is documented in `schema.sql` itself.
- **`notifications.subject_id`** is deliberately not a real foreign key —
  it's polymorphic (points into whichever table `subject_type` names), and
  Postgres can't enforce referential integrity across a polymorphic
  reference. Accepted risk, not an oversight — see EXPLAIN_BACK.md.
