# Architectural Decision Record (ADR)

Title: Database migration tooling — node-pg-migrate, raw SQL only

Date: 10/10/26

Status: accepted

## Summary:

Issue and Context:

> `apps/backend/db/schema.sql` describes the database but has never been applied anywhere. There's no versioned, reversible way to build or change the schema, so local dev, CI, and an eventual RDS instance can't be kept identical.

Decision:

> Use node-pg-migrate in `apps/backend`, with every migration written as raw SQL through `pgm.sql(...)`. Its table-builder DSL is never used.

## Details

### Context and Problem Statement

> Day 3 makes the schema real. We need a tool that applies ordered migrations, records which have run, supports `down` migrations (`.claude/docs/migrations.md`: "every migration has a tested down"), runs in CI against a throwaway Postgres, and doesn't fight `.claude/docs/sql.md`'s rule: "No query builder or ORM in v1 — the point is to read and reason about the SQL."

## Considered Options

1. **node-pg-migrate (raw `pgm.sql` only)**
   - Pros
     - npm-native: installs with the rest of the workspace and runs in the existing Node CI image. No extra runtime.
     - Wraps all pending migrations in one transaction by default (`--single-transaction`), so a failed run applies nothing, keeps run history in a `pgmigrations` table, and takes an advisory lock so two concurrent runs can't collide.
     - `pgm.sql(...)` accepts arbitrary SQL, so migrations stay plain DDL a reviewer can read line by line.
     - `up`/`down` live in one file, so the reversal sits next to the change it reverses.
   - Cons
     - It ships a DSL (`pgm.createTable`, `pgm.addColumn`, …) that's tempting to use. Mitigated by a rule stated in every migration's header comment.
     - v9 is ESM-only, so migrations are `.mjs` files even though `apps/backend` is CommonJS.
2. **Prisma Migrate / Drizzle Kit**
   - Pros
     - Migrations generated from a schema model, plus type-safe clients.
   - Cons
     - ORM/query-builder coupled, which directly contradicts sql.md. Generated SQL is read after the fact instead of written deliberately.
3. **Knex migrations**
   - Cons
     - Built around the Knex query builder, which sql.md also excludes.
4. **dbmate / Flyway / sqitch (plain `.sql` files)**
   - Pros
     - Pure SQL files.
   - Cons
     - A separate Go binary, JVM, or Perl toolchain to install locally and in CI, outside npm's lockfile.

### Decision outcome

> Install `node-pg-migrate`, `pg` and `@types/pg` as `apps/backend` devDependencies (backend-owned; the root `package.json` stays empty per ADR 5). Migrations live in `apps/backend/db/migrations/` as `.mjs` files containing only `pgm.sql(...)`. Scripts: `migrate:up`, `migrate:down` (one step), `migrate:down:all`, `migrate:create`. All of them read `DATABASE_URL`.

#### **Chosen option**: node-pg-migrate (raw `pgm.sql` only), because it's the only npm-native option that allows hand-written SQL, which resolves the conflict between needing a migration runner and sql.md's no-builder rule.

### Consequences

> - Easier: local, CI and future RDS are all built by the same ordered files, and CI proves every `down` by running up → down-all → up.
> - Harder: `schema.sql` is now a hand-maintained snapshot that can drift from the migrations. It must be updated in the same PR as any migration.
> - `pg` moves from devDependencies to dependencies when the repository layer ships.

## Revisit trigger

- A migration needs something `pgm.sql` can't express inside a transaction (e.g. `CREATE INDEX CONCURRENTLY`). Use node-pg-migrate's `pgm.noTransaction()` first, and only reconsider the tool if that's insufficient.
- node-pg-migrate stops being maintained, or a major version drops raw-SQL support.
- `schema.sql` drift causes a real bug. If that happens, generate it with `pg_dump --schema-only` instead of maintaining it by hand.

---

## Confirmation

> `.github/workflows/ci-backend.yml` runs `migrate:up`, `migrate:down:all` and `migrate:up` against a Postgres 17 service container, then the jest DB tests. In review, any migration containing a `pgm.` call other than `pgm.sql` is rejected.
