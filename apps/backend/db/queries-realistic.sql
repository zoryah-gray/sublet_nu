------------------------------------------------------------------------------------
-- REALISTIC /browse QUERIES — combined multi-predicate forms
--
-- Derived from the Day 4 measurement-pass report (10/18/26). The first-pass
-- queries.sql tested one predicate at a time; the report's own "Flags for
-- discussion" (#1) and "Not measured in this pass" sections identified what's
-- actually missing: (a) /browse's structural baseline, display_status='public',
-- combined with other filters rather than tested in isolation, and (b) a few
-- query shapes the battery never exercised at all (overlap, idx_quarters, KNN).
--
-- Every query here bakes in `display_status = 'public'` as a baseline, not a
-- toggle — per the schema, /browse structurally never shows non-public rows,
-- so that's not an "optional filter" the way place_type/rent/dates/quarter are.
--
-- Index pass notes (per the report's own isolation methodology — one index
-- created, measured, dropped per pass): queries 1-4 and 6 are each written to
-- slot into the SAME single-index passes already run (01/03/idx_quarters/04).
-- Query 5 is different on purpose — see its comment.
------------------------------------------------------------------------------------

-- ===== 1. public + place_type + rent range =====
-- Same shape as the DIAGNOSTIC row in test 1 that actually used
-- idx_sublets_place_rent — promoting it to a first-class query, since the
-- report's flag #1 asks whether /browse's real query ever looks like this.
EXPLAIN ANALYZE (
    SELECT id, title, monthly_rent, place_type
    FROM sublets
    WHERE display_status = 'public'
      AND place_type = 'private'
      AND monthly_rent BETWEEN 500 AND 900
);

-- ===== 2. public + date containment =====
-- Same promotion, for idx_sublets_date_range (daterange GiST) / the two-column
-- variants — whichever index design you land on from test 3.
EXPLAIN ANALYZE (
    SELECT id, title, availability_date_range
    FROM sublets
    WHERE display_status = 'public'
      AND availability_date_range @> '[2027-01-01,2027-04-01]'::daterange
);

-- ===== 3. public + date OVERLAP (not containment) — NOT measured in the last pass =====
-- "any availability during my search window" rather than "covers the whole
-- window" — report explicitly flagged this as the other case range types
-- usually win on, and it wasn't tested. Same index as #2; different operator.
EXPLAIN ANALYZE (
    SELECT id, title, availability_date_range
    FROM sublets
    WHERE display_status = 'public'
      AND availability_date_range && '[2027-01-01,2027-04-01]'::daterange
);

-- ===== 4. public + quarter filter — idx_quarters, NOT measured at all last pass =====
-- EXISTS rather than a JOIN: a sublet offering more than one of the requested
-- quarters should still appear once in a results list, not once per matching
-- quarter. (The very first general query in the existing queries.sql uses a
-- LEFT JOIN on purpose, because showing which quarter is the point there —
-- that's a different use case from filtering.)
EXPLAIN ANALYZE (
    SELECT s.id, s.title
    FROM sublets s
    WHERE s.display_status = 'public'
      AND EXISTS (
          SELECT 1 FROM sublet_quarters sq
          WHERE sq.sublet_id = s.id
            AND sq.quarter = ANY (ARRAY['Winter','Spring']::quarter[])
      )
);

-- ===== 5. "Kitchen sink" — every optional /browse filter active at once =====
-- NOT an isolated single-index pass like 1-4. This one is meant to be run
-- with idx_sublets_place_rent, the date-range index, AND idx_quarters all
-- created SIMULTANEOUSLY — the actual deployed state, not the one-index-at-
-- a-time isolation the report used to diagnose each index individually. The
-- point of this query is to see how the planner behaves when several
-- partial/composite indexes could all apply at once (a bitmap AND across
-- them, or the planner picking only the most selective one) — something the
-- isolated methodology deliberately couldn't show.
EXPLAIN ANALYZE (
    SELECT s.id, s.title, s.monthly_rent, s.place_type, s.availability_date_range
    FROM sublets s
    WHERE s.display_status = 'public'
      AND s.place_type = 'private'
      AND s.monthly_rent BETWEEN 500 AND 900
      AND s.availability_date_range @> '[2027-01-01,2027-04-01]'::daterange
      AND EXISTS (
          SELECT 1 FROM sublet_quarters sq
          WHERE sq.sublet_id = s.id
            AND sq.quarter = ANY (ARRAY['Winter','Spring']::quarter[])
      )
);

-- ===== 6. public + rent + spatial radius ("near campus AND affordable") =====
-- Realistic compound filter — run with idx_sublets_place_rent and
-- idx_sublets_coord both created, same "combined, not isolated" reasoning
-- as #5, just a smaller combination.
EXPLAIN ANALYZE (
    SELECT id, title, monthly_rent
    FROM sublets
    WHERE display_status = 'public'
      AND monthly_rent BETWEEN 500 AND 900
      AND ST_DWithin(
          coordinates,
          ST_SetSRID(ST_MakePoint(-87.681770, 42.049911), 4326),
          1609.34
      )
);

-- ===== 7. ISOLATED: public + rent only, no place_type =====
-- A real user may filter by rent with no other filter active at all. This is
-- deliberately NOT the same as query #1 — #1 combines place_type AND rent so
-- the composite index's leading column (place_type) has an equality predicate
-- to seek on. Here there's no place_type predicate at all, which means the
-- composite idx_sublets_place_rent(place_type, monthly_rent) can't be used to
-- SEEK on monthly_rent — same "can't skip the leading column" rule from the
-- Day 4 DECIDE. Expect this to look like Z's original test-1 query (seq scan),
-- just with the public baseline now correctly included. If isolated-rent
-- filtering turns out to be common in practice, this result is the argument
-- for a second, separate partial index on monthly_rent alone.
EXPLAIN ANALYZE (
    SELECT id, title, monthly_rent
    FROM sublets
    WHERE display_status = 'public'
      AND monthly_rent BETWEEN 500 AND 900
);

-- ===== 8. ISOLATED: public + place_type only, no rent =====
-- The other direction of #8: equality-only on the composite index's leading
-- column, no range predicate on the second column at all. This SHOULD still
-- be able to use idx_sublets_place_rent, since the index only requires the
-- leading column to seek — the range column just doesn't narrow anything
-- further when it's absent from the query. Useful contrast against #8: if
-- this one uses the index and #8 doesn't, that's direct confirmation of the
-- leading-column rule, not just a theoretical claim about it.
EXPLAIN ANALYZE (
    SELECT id, title, place_type
    FROM sublets
    WHERE display_status = 'public'
      AND place_type = 'private'
);

-- ===== 9. ISOLATED: public + spatial only =====
-- The report's own test 4 (coordinates GiST) never included the public
-- baseline — it ran ST_DWithin alone. This is that same query with the
-- structural filter correctly added, since /browse would never omit it.
EXPLAIN ANALYZE (
    SELECT id, title
    FROM sublets
    WHERE display_status = 'public'
      AND ST_DWithin(
          coordinates,
          ST_SetSRID(ST_MakePoint(-87.681770, 42.049911), 4326),
          1609.34
      )
);

-- Note: queries #2 (date containment), #3 (date overlap), and #4 (quarter)
-- above are ALREADY isolated single-filter forms — each has only the public
-- baseline plus its one filter, nothing else layered on. They're listed near
-- the top because they correspond directly to the report's existing index
-- passes (date-range, idx_quarters), not because they're combined queries.

-- ===== 10. KNN "sort by distance" — NOT measured in the last pass =====
-- A different browse mode entirely: not "is this within X radius" but
-- "show me the closest N listings first." PostGIS's <-> KNN operator
-- supports geography as well as geometry (since PostGIS 2.2, on a sphere
-- model rather than geography's usual spheroid — a known, documented
-- precision tradeoff for KNN specifically, not a bug). Confirm with the
-- EXPLAIN plan whether idx_sublets_coord is actually used for the ORDER BY —
-- the docs note the index only kicks in when one side of <-> is a constant,
-- which it is here, but don't take that as guaranteed without checking.
EXPLAIN ANALYZE (
    SELECT id, title,
           coordinates <-> ST_SetSRID(ST_MakePoint(-87.681770, 42.049911), 4326) AS distance_m
    FROM sublets
    WHERE display_status = 'public'
    ORDER BY distance_m
    LIMIT 20
);