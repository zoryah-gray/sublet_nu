-- SubletNU — schema.sql (Not applied as a migration)
-- Hand-maintained snapshot of the schema AFTER the latest migration in
-- db/migrations/ (currently 1793155578946_add-public-rent-sort-index). The migrations
-- are what actually build the database; keep this file in sync with them.
-- Conventions per .claude/docs/sql.md: snake_case, plural tables, timestamptz UTC,
--
-- State-transition LEGALITY (is pending->accepted allowed right now) is enforced
-- in the repository layer inside a locked transaction, per sql.md — CHECK
-- constraints here only guard against an invalid status string being written at
-- all, never against an illegal transition between two valid ones.
--
-- ON DELETE convention: RESTRICT on every FK pointing at a row with independent
-- business meaning (users, sublets, match_requests, threads). Nothing here is
-- designed to be hard-deleted by a raw DELETE during normal operation — every
-- "delete" the app performs is a soft delete (a deleted_at column / a
-- display_status value). The one deliberate CASCADE exception is `favorites`.


-- ─────────────────────────────────────────────────────────────────────────────
-- users
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  email         text NOT NULL UNIQUE,           -- @u.northwestern.edu; auth wiring not implemented yet
  bio           text NOT NULL DEFAULT '',
  is_public     boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),  -- frontend's `joinedAt` — renamed at the repository/DTO layer, not here
  deleted_at    timestamptz                      -- soft-delete marker. NULL = active account.
);

-- ─────────────────────────────────────────────────────────────────────────────
-- sublets
-- ─────────────────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS postgis;   -- RDS: requires rds_superuser (see TODO.md)

CREATE TABLE sublets (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id            uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  title               text NOT NULL,
  street_address      text NOT NULL,             -- street line only, e.g. '1234 Hinman Ave'
  city                text NOT NULL,
  state               text NOT NULL CHECK (state ~ '^[A-Z]{2}$'),     -- 2-letter code, e.g. 'IL'
  zip_code            text NOT NULL CHECK (zip_code ~ '^[0-9]{5}$'),  -- text, not integer, so leading zeros survive
  coordinates         geography(POINT, 4326) NOT NULL,  -- EXACT location: owner / confirmed renter only
  monthly_rent        numeric(10,2) NOT NULL,
  bedroom_count       smallint NOT NULL,         -- 0 = studio
  bathroom_count      numeric(3,1) NOT NULL,     -- 1.5 = one full + one half bath
  availability_date_range daterange NOT NULL,   -- built '[]' from start/end; stored canonically as [start, end + 1)
  description         text NOT NULL,
  image_hue           text,
  place_type          text CHECK (place_type IN ('entire', 'private')),
  roommate_count      smallint,
  utilities_included  boolean NOT NULL DEFAULT false,
  monthly_utilities_cost numeric(8,2),           -- estimate, when utilities_included = false

  -- Visibility (Design 1 review §1)
  display_status      text NOT NULL DEFAULT 'private'
                         CHECK (display_status IN ('public', 'restricted', 'private', 'deleted')),
  confirmed_renter_id uuid REFERENCES users(id) ON DELETE RESTRICT,
                         -- set when a match_request against this sublet reaches 'confirmed'; the
                         -- exception that makes display_status = 'restricted' meaningful (visibility
                         -- check: session_user_id = owner_id OR session_user_id = confirmed_renter_id)
  is_draft            boolean NOT NULL DEFAULT true,
                         -- true = never gone public yet (a true draft); flips to false, once, the
                         -- first time display_status transitions to 'public', and never flips back
                         -- to true afterward — archiving a once-public sublet later doesn't restore
                         -- draft status. display_status alone can't carry this distinction on its
                         -- own: "still a draft" and "was public, owner archived it" are both
                         -- display_status = 'private'. The frontend's SubletStatus (Draft/Archived/
                         -- Active/Rented) badge is derived from (display_status, is_draft), not
                         -- stored directly — see definitions.ts.
  deleted_at          timestamptz,               -- set alongside display_status = 'deleted' when the OWNER deletes their account

  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),

  -- Public-safe location, derived by the database (rules must match
  -- packages/shared/src/address.ts; the backend DB test asserts parity).
  approx_coordinates  geography(POINT, 4326) GENERATED ALWAYS AS (
                        ST_SetSRID(ST_MakePoint(
                          floor(ST_X(coordinates::geometry) / 0.001) * 0.001 + 0.0005,
                          floor(ST_Y(coordinates::geometry) / 0.001) * 0.001 + 0.0005
                        ), 4326)::geography
                      ) STORED,                  -- center of its ~111 m x 83 m grid cell
  approximate_street  text GENERATED ALWAYS AS (
                        CASE
                          WHEN btrim(street_address) ~ '^[0-9]+[[:space:]]+.+$' THEN
                            CASE
                              WHEN floor(substring(btrim(street_address) FROM '^([0-9]+)')::numeric / 100) = 0
                                THEN substring(btrim(street_address) FROM '^[0-9]+[[:space:]]+(.+)$')
                              ELSE (floor(substring(btrim(street_address) FROM '^([0-9]+)')::numeric / 100) * 100)::text
                                || ' block of ' || substring(btrim(street_address) FROM '^[0-9]+[[:space:]]+(.+)$')
                            END
                          ELSE btrim(street_address)
                        END
                      ) STORED,                  -- '1234 Hinman Ave' -> '1200 block of Hinman Ave'
  title_search        tsvector GENERATED ALWAYS AS (to_tsvector('english', title)) STORED,   -- full-text search; query with the same 'english' config

  CONSTRAINT sublets_availability_range_valid CHECK (
    NOT isempty(availability_date_range)
    AND NOT lower_inf(availability_date_range)
    AND NOT upper_inf(availability_date_range)
    AND upper(availability_date_range) - lower(availability_date_range) >= 2   -- end_date > start_date
  ),
  -- geography itself only guards type + SRID: out-of-range lat/lng are silently
  -- WRAPPED (95° -> 85°), EMPTY and NaN pass. The service-area box catches all three.
  CONSTRAINT sublets_coordinates_valid CHECK (
    NOT ST_IsEmpty(coordinates::geometry)
    AND ST_Y(coordinates::geometry) BETWEEN 41.6 AND 42.2      -- Chicagoland (Evanston + Chicago campus)
    AND ST_X(coordinates::geometry) BETWEEN -88.0 AND -87.5
  )
);

CREATE INDEX sublets_owner_id_idx        ON sublets(owner_id);
-- /browse indexes (docs/reports/index-optimization-explain-report.md)
CREATE INDEX idx_sublets_place_rent   ON sublets (place_type, monthly_rent) WHERE display_status = 'public';   -- equality before range
CREATE INDEX idx_sublets_date_range   ON sublets USING gist (availability_date_range) WHERE display_status = 'public';
CREATE INDEX idx_sublets_coord        ON sublets USING gist (coordinates);         -- exact point (owner / renter / internal)
CREATE INDEX idx_sublets_approx_coord ON sublets USING gist (approx_coordinates) WHERE display_status = 'public';   -- public radius / KNN
CREATE INDEX idx_sublets_public_created ON sublets (created_at DESC) WHERE display_status = 'public';   -- newest-first browse; replaced sublets_display_status_idx
CREATE INDEX idx_sublets_title_search ON sublets USING gin (title_search) WHERE display_status = 'public';   -- title search: filter on title_search @@ ..., not to_tsvector(title)
CREATE INDEX idx_sublets_public_rent ON sublets (monthly_rent, id) WHERE display_status = 'public';   -- price sort asc / desc (backward scan); id = tiebreaker

-- What any query on behalf of a non-owner, non-confirmed-renter may read.
-- Excludes street_address, coordinates, confirmed_renter_id, deleted_at,
-- is_draft, display_status. The server/actions layer decides who may use the
-- base table instead; this view makes the public path unable to leak exact data.
CREATE VIEW public_sublets AS
  SELECT id, owner_id, title, approximate_street, city, state, zip_code,
         approx_coordinates, monthly_rent, bedroom_count, bathroom_count,
         availability_date_range, description, image_hue, place_type,
         roommate_count, utilities_included, monthly_utilities_cost,
         created_at, updated_at, title_search
  FROM sublets
  WHERE display_status = 'public';


-- Quarters are not stored per listing: they're derived from
-- availability_date_range and these Registrar exam dates by
-- packages/shared/src/terms.ts (rules v2, ADR 7): Fall starts Sep 1; 14-day
-- minimum overlap; move-out day not counted; year-long leases keep a repeated
-- quarter only at the end with more days; missing dates projected from the
-- previous year + 1 year. Reference data, entered by a migration each year.
CREATE TABLE academic_calendar (
  academic_year    smallint PRIMARY KEY,   -- 2026 = the 2026–27 academic year
  fall_exams_end   date,                   -- NULL = not published yet (projected)
  winter_exams_end date,
  spring_exams_end date,
  -- Each exam date in its usual months; the windows also imply their order.
  CONSTRAINT academic_calendar_windows CHECK (
    fall_exams_end BETWEEN make_date(academic_year, 11, 1) AND make_date(academic_year, 12, 31)
    AND winter_exams_end BETWEEN make_date(academic_year + 1, 2, 1) AND make_date(academic_year + 1, 4, 30)
    AND spring_exams_end BETWEEN make_date(academic_year + 1, 5, 1) AND make_date(academic_year + 1, 7, 31)
  )
);

-- Planner statistics for the /browse term filter (searchSublets): start and
-- move-out bounds, and stay length (the year-long exclusion's prefilter).
CREATE STATISTICS sublets_availability_lower ON (lower(availability_date_range)) FROM sublets;
CREATE STATISTICS sublets_availability_upper ON (upper(availability_date_range)) FROM sublets;
CREATE STATISTICS sublets_availability_nights ON ((upper(availability_date_range) - lower(availability_date_range))) FROM sublets;

CREATE TABLE sublet_images (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sublet_id   uuid NOT NULL REFERENCES sublets(id) ON DELETE RESTRICT,
  url         text NOT NULL,
  position    smallint NOT NULL,        -- 0 = featured image; ordering for the gallery
  created_at  timestamptz NOT NULL DEFAULT now(),
  alt         text,                     -- accessibility alt text; nullable. width/height intentionally not stored (upload-pipeline concern)
  UNIQUE (sublet_id, position)
);

CREATE TABLE sublet_videos (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sublet_id   uuid NOT NULL REFERENCES sublets(id) ON DELETE RESTRICT,
  url         text NOT NULL,
  position    smallint NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sublet_id, position)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- favorites
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE favorites (
  user_id     uuid NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
  sublet_id   uuid NOT NULL REFERENCES sublets(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, sublet_id)
);

CREATE INDEX favorites_sublet_id_idx ON favorites(sublet_id);  -- "who has this favorited" — drives the favorited-sublet-updated notification fan-out

-- ─────────────────────────────────────────────────────────────────────────────
-- match_requests — the correctness core of the app (sql.md)
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Legal transitions (enforced in the repository layer, NOT by the CHECK below):
--
--   pending   -> accepted          owner accepts
--   pending   -> declined          owner declines
--   pending   -> cancelled         requester withdraws
--   accepted  -> confirmed         owner confirms after talking (sets sublets.confirmed_renter_id)
--   accepted  -> declined          owner rejects / closes conversation during talks
--   accepted  -> cancelled         requester withdraws while in talks
--   declined  -> pending           RE-REQUEST — see guard below
--   cancelled -> pending           RE-REQUEST — see guard below
--   pending | accepted -> listing_removed   owner deletes their account
--   confirmed, listing_removed are terminal — no transitions out.
--
-- Re-request guard, all three checked by the repository method before the
-- UPDATE, inside the row-locked transaction sql.md requires:
--   1. sublets.display_status = 'public' for this sublet_id right now
--      (reopening a listing is a sublets.display_status transition, not a
--      rule that lives on match_requests)
--   2. now() - last_transitioned_at >= interval '7 days'
--   3. the resubmission supplies a new, non-empty `message` value
--      (repository-enforced — comparing against the row's own prior value
--      requires reading history, which a CHECK constraint can't do)

CREATE TABLE match_requests (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sublet_id            uuid NOT NULL REFERENCES sublets(id) ON DELETE RESTRICT,
  owner_id             uuid NOT NULL REFERENCES users(id)   ON DELETE RESTRICT,  -- denormalized from sublets.owner_id at insert time — avoids a join on the "requests I've received" query; safe because ownership transfer isn't a v1 feature
  requester_id         uuid NOT NULL REFERENCES users(id)   ON DELETE RESTRICT,
  status               text NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending', 'accepted', 'confirmed', 'declined', 'cancelled', 'listing_removed')),
  message              text NOT NULL,
  thread_id            uuid,             -- FK added via ALTER TABLE below — see the circular-reference note
  created_at           timestamptz NOT NULL DEFAULT now(),
  last_transitioned_at timestamptz NOT NULL DEFAULT now()      -- the 7-day cooldown check reads this
);

CREATE UNIQUE INDEX match_requests_one_pending_per_sublet
  ON match_requests(sublet_id, requester_id)
  WHERE status = 'pending';

CREATE INDEX match_requests_owner_id_idx     ON match_requests(owner_id);
CREATE INDEX match_requests_requester_id_idx ON match_requests(requester_id);
CREATE INDEX idx_match_requests_sublet        ON match_requests(sublet_id);   -- owner inbox per listing + FK check on sublet delete

-- ─────────────────────────────────────────────────────────────────────────────
-- message_threads / messages / message_media / thread_read_state
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE message_threads (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_request_id  uuid NOT NULL UNIQUE REFERENCES match_requests(id) ON DELETE RESTRICT,
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- Circular reference resolved: match_requests.thread_id couldn't carry its FK
-- constraint above because message_threads didn't exist yet. Add it now that
-- both tables do — this ALTER TABLE is the second half of creating
-- match_requests, not an optional afterthought.
ALTER TABLE match_requests
  ADD CONSTRAINT match_requests_thread_id_fkey
  FOREIGN KEY (thread_id) REFERENCES message_threads(id) ON DELETE RESTRICT;

CREATE TABLE messages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id   uuid NOT NULL REFERENCES message_threads(id) ON DELETE RESTRICT,
  sender_id   uuid NOT NULL REFERENCES users(id)           ON DELETE RESTRICT,
  body        text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX messages_thread_id_created_at_idx ON messages(thread_id, created_at);  -- "fetch a conversation, in order"

CREATE TABLE message_media (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id  uuid NOT NULL REFERENCES messages(id) ON DELETE RESTRICT,
  type        text NOT NULL CHECK (type IN ('image', 'video')),
  url         text NOT NULL,            -- generated storage key, not the original filename
  file_name   text NOT NULL,            -- original upload filename; shown as caption/alt in the UI
  position    smallint NOT NULL,
  UNIQUE (message_id, position)
);

CREATE TABLE thread_read_state (
  thread_id     uuid NOT NULL REFERENCES message_threads(id) ON DELETE RESTRICT,
  user_id       uuid NOT NULL REFERENCES users(id)           ON DELETE RESTRICT,
  last_read_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (thread_id, user_id)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- notifications
-- ─────────────────────────────────────────────────────────────────────────────
-- Written on: every match_requests status transition, every new message, and
-- an update to a sublet that changes monthly_rent, availability_date_range, or
-- display_status (finalized field list — a typo fix in the description does
-- NOT trigger this). Quarters are derived from availability_date_range, so a
-- quarter change is always a date change; no separate comparison is needed.
-- subject_id is intentionally NOT a foreign key — it points into whichever
-- table subject_type names, and Postgres cannot enforce referential integrity
-- across a polymorphic reference like this.

CREATE TABLE notifications (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  type         text NOT NULL,
  subject_type text NOT NULL CHECK (subject_type IN ('match_request', 'sublet', 'thread')),
  subject_id   uuid NOT NULL,             -- polymorphic — no FK
  payload      jsonb NOT NULL DEFAULT '{}'::jsonb,  -- a single object, not a list — stays jsonb
  created_at   timestamptz NOT NULL DEFAULT now(),
  read_at      timestamptz
);

CREATE INDEX notifications_user_id_created_at_idx ON notifications(user_id, created_at DESC);
CREATE INDEX notifications_unread_idx ON notifications(user_id) WHERE read_at IS NULL;

-- type values (must match NotificationKind in app/lib/definitions.ts exactly):
--   match_request_received, match_request_accepted, match_request_declined,
--   match_request_cancelled, match_request_confirmed, match_request_listing_removed,
--   new_message, favorited_sublet_updated

-- ─────────────────────────────────────────────────────────────────────────────
-- Data Retention (finalized 09/07/26): 1 year
-- ─────────────────────────────────────────────────────────────────────────────
-- Any row with deleted_at set (users, sublets) becomes eligible for hard
-- deletion once deleted_at < now() - interval '1 year'. This is NOT enforced
-- by anything in this file — it's a scheduled job and on TODO
-- Not a database constraint, because the purge has to walk dependency order itself:
-- message_media -> messages -> thread_read_state -> message_threads ->
-- match_requests -> sublets -> users. RESTRICT on every FK above guarantees
-- that job can't skip a step by accident — Postgres will refuse each DELETE
-- out of order.
