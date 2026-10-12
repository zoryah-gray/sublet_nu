// Splits the old free-text address ("1234 Hinman Ave, Evanston, IL") into
// street_address (renamed in the previous migration) + city + state + zip_code,
// and drops neighborhood (the UI shows city in its place).
//
// NOT NULL without a default and a same-PR DROP COLUMN both break
// .claude/docs/migrations.md's expand/contract. Safe here only because every
// database that exists (local docker, CI) has zero sublets rows and nothing
// reads these columns through SQL yet. This exception expires the moment an
// RDS instance serves live traffic.
//
// RULE: migrations use pgm.sql(...) only — never the pgm.createTable()-style DSL.

export const shorthands = undefined;

export const up = (pgm) => {
  pgm.sql(`
    SET LOCAL lock_timeout = '5s';
    ALTER TABLE sublets
      ADD COLUMN city text NOT NULL,
      ADD COLUMN state text NOT NULL CHECK (state ~ '^[A-Z]{2}$'),
      ADD COLUMN zip_code text NOT NULL CHECK (zip_code ~ '^[0-9]{5}$'),
      DROP COLUMN neighborhood;
  `);
};

// LOSSY: neighborhood values dropped by up() cannot be recovered. The DEFAULT
// lets this down() succeed on a populated table; it is removed right after so
// the restored column matches the baseline's shape.
export const down = (pgm) => {
  pgm.sql(`
    SET LOCAL lock_timeout = '5s';
    ALTER TABLE sublets
      ADD COLUMN neighborhood text NOT NULL DEFAULT '',
      DROP COLUMN zip_code,
      DROP COLUMN state,
      DROP COLUMN city;
    ALTER TABLE sublets ALTER COLUMN neighborhood DROP DEFAULT;
  `);
};
