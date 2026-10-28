// /browse and owner-inbox indexes, finalized by Z after the Day 4 measurement
// passes 1–3 (docs/reports/index-optimization-explain-report.md).
// Depends on 1791947964406_update-sublets-date-coords (coordinates,
// availability_date_range, postgis) and 1793032424185_add-public-safe-columns
// (approx_coordinates).
//
// - idx_sublets_place_rent, idx_sublets_date_range: partial on public rows, the
//   shape public_sublets queries always have.
// - Two spatial indexes, by Z's choice: idx_sublets_coord on the exact point
//   (owner / confirmed-renter / internal use) and idx_sublets_approx_coord on
//   the public-safe point, which public radius and nearest-first queries
//   (through public_sublets) actually search and sort on.
// - idx_sublets_public_created REPLACES sublets_display_status_idx (pass 3):
//   newest-first browse pages read in index order and stop at LIMIT, and it
//   serves every query the old index did (count of public rows, the "list of
//   public rows" role) with no measured regression.
// - idx_match_requests_sublet: the owner's request inbox for one listing, and
//   the FK check when a sublet is deleted (pass 3: 1,191 ms -> 11 ms for 200
//   deletes). match_requests_one_pending_per_sublet can't serve either — it
//   only covers pending rows.
// - Not included, by Z's decision: an index on sublets.confirmed_renter_id.
//
// Plain CREATE INDEX inside the migration's transaction, not CONCURRENTLY.
// .claude/docs/migrations.md requires CONCURRENTLY for a populated table under
// live writes; no database this first runs on has either (CI is empty, local
// holds only seed fixtures, RDS doesn't exist yet). In-transaction creation
// keeps the migration atomic — all of it or none. If this ever runs against a
// table taking production writes, switch each statement to
// CREATE INDEX CONCURRENTLY with pgm.noTransaction().
//
// RULE: migrations use pgm.sql(...) only — never the pgm.createTable()-style DSL.

export const shorthands = undefined;

export const up = (pgm) => {
  pgm.sql(`
    SET LOCAL lock_timeout = '5s';
    CREATE INDEX idx_sublets_place_rent ON sublets (place_type, monthly_rent)
      WHERE display_status = 'public';
    CREATE INDEX idx_sublets_date_range ON sublets USING gist (availability_date_range)
      WHERE display_status = 'public';
    CREATE INDEX idx_sublets_coord ON sublets USING gist (coordinates);
    CREATE INDEX idx_sublets_approx_coord ON sublets USING gist (approx_coordinates)
      WHERE display_status = 'public';
    DROP INDEX sublets_display_status_idx;
    CREATE INDEX idx_sublets_public_created ON sublets (created_at DESC)
      WHERE display_status = 'public';
    CREATE INDEX idx_match_requests_sublet ON match_requests (sublet_id);
  `);
};

export const down = (pgm) => {
  pgm.sql(`
    SET LOCAL lock_timeout = '5s';
    DROP INDEX idx_match_requests_sublet;
    DROP INDEX idx_sublets_public_created;
    -- restore exactly as 1791678008021_baseline-schema created it
    CREATE INDEX sublets_display_status_idx ON sublets (display_status) WHERE display_status = 'public';
    DROP INDEX idx_sublets_approx_coord;
    DROP INDEX idx_sublets_coord;
    DROP INDEX idx_sublets_date_range;
    DROP INDEX idx_sublets_place_rent;
  `);
};
