# Explain-Back — schema-setup

Non-obvious decisions in this branch. Per CLAUDE.md's Explain-Back gate: I
should be able to explain every item here without this file open before the
branch merges.

## Schema (`backend/db/schema.sql`)

**Why `match_requests.thread_id`'s FK is added via `ALTER TABLE` after
`message_threads` is created, not inline in the `CREATE TABLE`.**
`match_requests` and `message_threads` reference each other:
`message_threads.match_request_id` points at `match_requests`, and
`match_requests.thread_id` points at `message_threads`. Whichever table is
created first can't declare an inline FK to a table that doesn't exist yet.
Resolution: create `match_requests` with `thread_id` as a plain nullable
column (no FK yet), create `message_threads` (its FK to `match_requests` is
fine — that table already exists), then `ALTER TABLE match_requests ADD
CONSTRAINT ... FOREIGN KEY (thread_id) REFERENCES message_threads(id)`. The
`ALTER TABLE` is the second half of creating `match_requests`, not an
optional afterthought — the table isn't fully constrained until it runs.

**Why every meaningful FK is `ON DELETE RESTRICT`, and why `favorites` is
the one exception (`CASCADE`).** Every "delete" this app performs during
normal operation is a soft delete (a `deleted_at` column or a
`display_status` value) — nothing is designed to be hard-deleted by a raw
`DELETE` in the normal request path. `RESTRICT` makes that discipline
enforceable: if some future code path ever issues a raw `DELETE FROM users`,
Postgres refuses it loudly instead of silently cascading through sublets,
match requests, and messages with no notification path. `favorites` is the
one table where a cascaded delete does no harm — a favorite carries no
independent significance, and nobody needs to be told "your favorite
vanished because the sublet did."

**Why `sublet_quarters`/`sublet_images`/`sublet_videos`/`message_media` are
junction tables instead of array/jsonb columns, and why that does NOT
require `Sublet.quarters`/`images`/`videos` or `Message.media` in
`definitions.ts` to change shape.** Normalizing storage and widening the
frontend contract are two separate questions. The database stores these as
real rows so a single image can be queried/indexed/referentially checked on
its own, and a quarter value is a real FK into the `quarter` enum rather
than a free-floating array element that could typo. The repository layer
(Day 3+) reassembles those rows back into arrays (`SELECT url FROM
sublet_images WHERE sublet_id = $1 ORDER BY position`) before the DTO
leaves the backend — the frontend keeps receiving exactly the arrays it
already expects.

**The `deriveSubletStatus` mapping, and why it's not a stored column.**
`displayStatus` (`public`/`restricted`/`private`/`deleted`) plus `isDraft`
together can't be collapsed into a single stored enum, because two
meaningfully different states — "still an unpublished draft" and "was
public, owner archived it" — are both `displayStatus: 'private'`. Storing a
derived label instead of computing it would mean keeping two representations
of the same fact in sync by hand. The mapping: `restricted → rented`,
`public → active`, `private` + `isDraft → draft`, `private` + not-draft
`→ archived`, `deleted → null` (signals "don't render this," not a fake
status).

**The re-request guard's three checks.** A `declined`/`cancelled` request
can become `pending` again only if: (1) `sublets.display_status = 'public'`
right now — reopening a listing is a `sublets` transition, not a rule that
belongs on `match_requests`; (2) `now() - last_transitioned_at >= interval
'7 days'` — a cooldown, read from the row's own timestamp; (3) the
resubmission supplies a new, non-empty `message` — this one can't be a
`CHECK` constraint because comparing against the row's *own prior value*
requires reading history, which a `CHECK` has no access to. All three are
repository-enforced inside the row-locked transaction, not database
constraints.

**Why `match_requests_one_pending_per_sublet` is a partial unique index
(`WHERE status = 'pending'`) instead of a table-wide `UNIQUE`.** A
requester can legitimately have multiple *non-pending* requests against the
same sublet over time (declined, then re-requested later, for example) —
a table-wide `UNIQUE (sublet_id, requester_id)` would block that. Scoping
the uniqueness constraint to `status = 'pending'` only prevents the actual
bug it exists to prevent: submitting two simultaneous pending requests for
the same sublet.

**Why `notifications.subject_type`/`subject_id` is deliberately not a
foreign key, and what that trades away.** `subject_id` is polymorphic — it
points into `match_requests`, `sublets`, or `messages`/`threads` depending
on `subject_type`, and Postgres has no way to enforce referential integrity
across a reference whose target table varies per row. Accepted risk, not an
oversight: soft-delete means the rows a notification points at rarely
actually disappear, so a dangling `subject_id` is an edge case, not the
common path — but it is a real one (a notification could, in principle,
outlive a hard-deleted row after the yearly purge job runs). No FK-level
safety net exists for that; the tradeoff is explicit here rather than
silently matched to the same pattern.

## Frontend type contract (`app/lib/definitions.ts`, `app/lib/utils.ts`)

**Why `getFilteredSublets()`'s browse filter changed semantics, not just
syntax.** The old filter was `s.status !== 'archived'` — it excluded
exactly one value and let everything else (including a hypothetical
`'draft'` sublet, since nothing ever filtered those) through to public
browse results. The new filter is `s.displayStatus === 'public'` — an
allow-list, not a deny-list. This is a genuine behavior change grounded in
the schema's own visibility model (only `'public'` is meant to be publicly
browsable), not a like-for-like rename. Same reasoning applied to the
public-profile page's "Active Listings" filter.

**The `KIND_BADGE` colors in `navbar.tsx` for the 5 net-new
`NotificationKind` values are my judgment call, not something you
specified.** I mirrored `MATCH_STATUS_STYLES`'s existing palette for the
overlapping concepts (declined→red, cancelled/listing_removed→gray,
confirmed→violet) and picked a new sky-blue for `favorited_sublet_updated`,
which had no prior art anywhere in the app. Worth a deliberate look before
merge, since these weren't in the finalized design notes.

## Explicitly not done on this branch

No yearly purge job, no notification fan-out triggers, no repository/API
code, no migration runner, no ADR-5 (yours to write per the review notes),
no `sent-requests-table.tsx`/`cards-layout.tsx` withdraw-to-real-`cancelled`
conversion (tracked in `PLAN.md` §7 instead — see there for why).
