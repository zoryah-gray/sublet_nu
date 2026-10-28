// Full-text search on sublets.title: a generated tsvector column, a GIN index
// on it, and the column exposed through public_sublets so
// db/repositories/sublets.ts searchSublets can query it with
// websearch_to_tsquery. Purely additive (nothing dropped or rewritten), so no
// expand/contract sequencing is needed.
//
// - to_tsvector('english', title): the two-argument form is IMMUTABLE, which a
//   generated column requires. The one-argument form reads
//   default_text_search_config at runtime, so Postgres rejects it here — and it
//   would let the stored vectors and the query's config silently diverge. The
//   query side must use 'english' too.
// - The index is on the column itself, so the query must filter with
//   `title_search @@ <tsquery>`. `to_tsvector('english', title) @@ ...` would
//   not match this index and falls back to a sequential scan.
// - Partial on display_status = 'public' like the other browse indexes;
//   public_sublets carries that predicate, so queries through it match.
//
// Plain CREATE INDEX in the migration's transaction, not CONCURRENTLY — same
// reasoning as 1793032425535_add-browse-indexes (no table under live writes yet).
//
// RULE: migrations use pgm.sql(...) only — never the pgm.createTable()-style DSL.

export const shorthands = undefined;

export const up = (pgm) => {
  pgm.sql(`
    SET LOCAL lock_timeout = '5s';
    ALTER TABLE sublets ADD COLUMN title_search tsvector
      GENERATED ALWAYS AS (to_tsvector('english', title)) STORED;
    CREATE INDEX idx_sublets_title_search ON sublets USING gin (title_search)
      WHERE display_status = 'public';
    -- OR REPLACE may only append columns, so title_search goes last.
    CREATE OR REPLACE VIEW public_sublets AS
      SELECT id, owner_id, title, approximate_street, city, state, zip_code,
             approx_coordinates, monthly_rent, bedroom_count, bathroom_count,
             availability_date_range, description, image_hue, place_type,
             roommate_count, utilities_included, monthly_utilities_cost,
             created_at, updated_at, title_search
      FROM sublets
      WHERE display_status = 'public';
  `);
};

export const down = (pgm) => {
  // A view column can't be removed with OR REPLACE: drop and recreate exactly
  // as 1793032424185_add-public-safe-columns defines it.
  pgm.sql(`
    SET LOCAL lock_timeout = '5s';
    DROP VIEW public_sublets;
    CREATE VIEW public_sublets AS
      SELECT id, owner_id, title, approximate_street, city, state, zip_code,
             approx_coordinates, monthly_rent, bedroom_count, bathroom_count,
             availability_date_range, description, image_hue, place_type,
             roommate_count, utilities_included, monthly_utilities_cost,
             created_at, updated_at
      FROM sublets
      WHERE display_status = 'public';
    DROP INDEX idx_sublets_title_search;
    ALTER TABLE sublets DROP COLUMN title_search;
  `);
};
