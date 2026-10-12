// Direct RENAME COLUMN, NOT the five-step expand/contract from
// .claude/docs/migrations.md. Safe here only because no deployed database
// exists and no code reads these columns through SQL yet — there is no old
// app version serving traffic for a rename to break. This exception expires
// the moment an RDS instance serves live traffic.
//
// RULE: migrations use pgm.sql(...) only — never the pgm.createTable()-style DSL.

export const shorthands = undefined;

export const up = (pgm) => {
  pgm.sql(`
    SET LOCAL lock_timeout = '5s';
    ALTER TABLE sublets RENAME COLUMN address TO street_address;
    ALTER TABLE sublets RENAME COLUMN beds TO bedroom_count;
    ALTER TABLE sublets RENAME COLUMN baths TO bathroom_count;
    ALTER TABLE sublets RENAME COLUMN price TO monthly_rent;
    ALTER TABLE sublets RENAME COLUMN roommates TO roommate_count;
    ALTER TABLE sublets RENAME COLUMN utilities_cost TO monthly_utilities_cost;
    ALTER TABLE message_media RENAME COLUMN name TO file_name;
  `);
};

export const down = (pgm) => {
  pgm.sql(`
    SET LOCAL lock_timeout = '5s';
    ALTER TABLE message_media RENAME COLUMN file_name TO name;
    ALTER TABLE sublets RENAME COLUMN monthly_utilities_cost TO utilities_cost;
    ALTER TABLE sublets RENAME COLUMN roommate_count TO roommates;
    ALTER TABLE sublets RENAME COLUMN monthly_rent TO price;
    ALTER TABLE sublets RENAME COLUMN bathroom_count TO baths;
    ALTER TABLE sublets RENAME COLUMN bedroom_count TO beds;
    ALTER TABLE sublets RENAME COLUMN street_address TO address;
  `);
};
