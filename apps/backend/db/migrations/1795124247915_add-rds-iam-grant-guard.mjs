// rds_iam membership and app_user's table grant, as a normal migration.
//
// Two different jobs, on purpose:
// - The one-time bootstrap stack (lib/bootstrap-migrator-role-stack.ts) CREATES
//   app_user and migrator_role, once, as the RDS master user. A migration can't:
//   migrator_role has no CREATEROLE, and creating it needs the master user.
// - This migration keeps the rds_iam grant portable and idempotent going
//   forward: on any environment where the roles exist (RDS, or a rebuilt RDS
//   instance after its bootstrap), it makes sure both are rds_iam members; on
//   local Docker and CI, where rds_iam doesn't exist, it does nothing.
//
// The rds_iam GRANT runs only if the role isn't already a member. migrator_role
// (who runs this on RDS) has no ADMIN OPTION on rds_iam, so after bootstrap it's
// a no-op, and if a role somehow exists without membership it fails loudly
// (permission denied) instead of silently leaving IAM login broken.
//
// GRANT SELECT, INSERT ON users TO app_user lives here, not in the bootstrap:
// users doesn't exist until migrations have run, and migrator_role owns it, so
// it can grant on it. post_confirmation.py needs exactly SELECT (display_name
// suffix check) and INSERT (... ON CONFLICT DO NOTHING).
//
// RULE: migrations use pgm.sql(...) only — never the pgm.createTable()-style DSL.

export const shorthands = undefined;

export const up = (pgm) => {
  pgm.sql(`
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'rds_iam') THEN
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user')
           AND NOT pg_has_role('app_user', 'rds_iam', 'MEMBER') THEN
          EXECUTE 'GRANT rds_iam TO app_user';
        END IF;
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'migrator_role')
           AND NOT pg_has_role('migrator_role', 'rds_iam', 'MEMBER') THEN
          EXECUTE 'GRANT rds_iam TO migrator_role';
        END IF;
      END IF;

      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
        EXECUTE 'GRANT SELECT, INSERT ON users TO app_user';
      END IF;
    END $$;
  `);
};

// Reverses only the table grant. rds_iam membership belongs to the bootstrap
// (and revoking it needs ADMIN OPTION, which migrator_role doesn't have).
export const down = (pgm) => {
  pgm.sql(`
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
        EXECUTE 'REVOKE SELECT, INSERT ON users FROM app_user';
      END IF;
    END $$;
  `);
};
