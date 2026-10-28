// Retires sublet_quarters (owner-declared quarters with no year) and the
// quarter enum. Quarters are now derived from availability_date_range and
// academic_calendar (1793123266286_add-academic-calendar,
// packages/shared/src/terms.ts), so they can't disagree with the dates.
//
// One-step contract, not the five-step expand/contract in
// .claude/docs/migrations.md — the same exception as
// 1791947964406_update-sublets-date-coords: no deployed database exists, and
// nothing reads this table through SQL (only the baseline migration and the
// seed script ever referenced it). This exception expires once an RDS
// instance serves live traffic.
//
// down() is lossy by design: it recreates the type and an EMPTY table. The
// rows are derivable from listing dates via the shared term rules.
//
// RULE: migrations use pgm.sql(...) only — never the pgm.createTable()-style DSL.

export const shorthands = undefined;

export const up = (pgm) => {
  pgm.sql(`
    SET LOCAL lock_timeout = '5s';
    DROP TABLE sublet_quarters;
    DROP TYPE quarter;
  `);
};

export const down = (pgm) => {
  // Same definitions as 1791678008021_baseline-schema.
  pgm.sql(`
    SET LOCAL lock_timeout = '5s';
    CREATE TYPE quarter AS ENUM ('Fall', 'Winter', 'Spring', 'Summer');
    CREATE TABLE sublet_quarters (
      sublet_id  uuid NOT NULL REFERENCES sublets(id) ON DELETE RESTRICT,
      quarter    quarter NOT NULL,
      PRIMARY KEY (sublet_id, quarter)
    );
  `);
};
