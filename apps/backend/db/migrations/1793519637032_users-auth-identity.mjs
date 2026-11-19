// Auth identity columns for Cognito-provisioned users (ADR 8).
//
// - name -> display_name: the column always meant the user-editable handle
//   (frontend UserProfile.name), not a human name; renamed to stop the two
//   being confused now that full_name exists. One-step RENAME instead of
//   expand/contract (.claude/docs/migrations.md) because no deployed code reads
//   or writes users yet — there is no "previous version" serving traffic.
// - display_name UNIQUE: post_confirmation.py picks the smallest free suffix
//   (allygoodman, allygoodman2, ...) but that check-then-insert can race under
//   concurrent signups. The constraint turns the race into a loud 23505 on the
//   second INSERT instead of a silent duplicate. The race itself is an
//   accepted, logged gap (EXPLAIN_BACK.md), not handled with locking/retry.
// - cognito_sub NOT NULL with no DEFAULT: safe only while users is empty in
//   every real environment. The pre-flight below fails readably if it isn't
//   (e.g. a local DB with db:seed rows — re-run the seed after migrating).
//   If real rows ever exist first, switch to expand/contract: nullable ->
//   backfill -> SET NOT NULL.
// - contact_method: NOT NULL with a constant DEFAULT is a metadata-only change
//   on Postgres 11+.
// - full_name: nullable; Google's `name` claim when Cognito provides it.
//   avatarInitials is derived from it at read time, never stored.
//
// RULE: migrations use pgm.sql(...) only — never the pgm.createTable()-style DSL.

export const shorthands = undefined;

export const up = (pgm) => {
  pgm.sql(`
    SET LOCAL lock_timeout = '5s';

    -- Empty table also means UNIQUE(display_name) can't hit existing duplicates.
    DO $$
    DECLARE
      existing_rows bigint;
    BEGIN
      SELECT count(*) INTO existing_rows FROM users;
      IF existing_rows > 0 THEN
        RAISE EXCEPTION 'users has % row(s); cognito_sub NOT NULL needs an empty table. Delete seed rows (re-run db:seed after) or use expand/contract.', existing_rows;
      END IF;
    END $$;

    ALTER TABLE users RENAME COLUMN name TO display_name;
    ALTER TABLE users ADD CONSTRAINT users_display_name_key UNIQUE (display_name);
    ALTER TABLE users ADD COLUMN cognito_sub uuid NOT NULL;
    ALTER TABLE users ADD CONSTRAINT users_cognito_sub_key UNIQUE (cognito_sub);
    ALTER TABLE users ADD COLUMN contact_method text NOT NULL DEFAULT 'in_app'
      CONSTRAINT users_contact_method_check CHECK (contact_method IN ('in_app', 'email'));
    ALTER TABLE users ADD COLUMN full_name text;
  `);
};

export const down = (pgm) => {
  pgm.sql(`
    SET LOCAL lock_timeout = '5s';
    ALTER TABLE users DROP COLUMN full_name;
    ALTER TABLE users DROP COLUMN contact_method;
    ALTER TABLE users DROP COLUMN cognito_sub;
    ALTER TABLE users DROP CONSTRAINT users_display_name_key;
    ALTER TABLE users RENAME COLUMN display_name TO name;
  `);
};
