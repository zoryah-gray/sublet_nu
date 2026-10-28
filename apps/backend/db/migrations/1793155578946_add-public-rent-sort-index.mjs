// Price sort for /browse (searchSublets sort: 'asc' | 'desc'). Measured in
// report pass 7 (apps/backend/db/explain/23-price-sort-index.txt): without it,
// a price-sorted page sorted every public row (~20 ms at 3,413 rows,
// emulated); with it, the page walks the index and stops at LIMIT (~0.2 ms).

// Column order: monthly_rent is the sort key (no equality filter precedes it);
// id makes every key unique and matches the query's tiebreaker. searchSublets
// orders asc as (monthly_rent ASC, id ASC) and desc as (monthly_rent DESC,
// id DESC), so one index serves both, the second as a backward scan.
// Partial on display_status = 'public' like the other browse indexes;
// public_sublets supplies the predicate.
//
// Plain CREATE INDEX inside the migration's transaction, not CONCURRENTLY —
// same reasoning as 1793032425535_add-browse-indexes (no table under live
// writes yet). Switch to CREATE INDEX CONCURRENTLY with pgm.noTransaction()
// if this ever runs against a table taking production writes.
//
// RULE: migrations use pgm.sql(...) only — never the pgm.createTable()-style DSL.

export const shorthands = undefined;

export const up = (pgm) => {
  pgm.sql(`
    SET LOCAL lock_timeout = '5s';
    CREATE INDEX idx_sublets_public_rent ON sublets (monthly_rent, id)
      WHERE display_status = 'public';
  `);
};

export const down = (pgm) => {
  pgm.sql(`
    SET LOCAL lock_timeout = '5s';
    DROP INDEX idx_sublets_public_rent;
  `);
};
