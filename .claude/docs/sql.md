# SQL and Data Access Conventions

Per ADR: repository pattern. `UserRepository`, `ListingRepository`,
`MatchRepository`, `MessageRepository`. All SQL lives in the repository layer.

## Rules

- Raw parameterized SQL. No string interpolation into queries, ever.
- No query builder or ORM in v1 — the point is to read and reason about the SQL.
- Every new query that touches a table over ~1,000 rows gets an
  `EXPLAIN (ANALYZE, BUFFERS)` pasted into the PR description.
- Composite index column order is a decision, not a default. State the reasoning.
- Any state transition on `match_requests` happens inside a transaction with the
  row locked. The match state machine is the correctness core of this app.
- `SELECT *` is not used in application code.

## Naming

- `snake_case` for tables and columns, plural table names.
- Timestamps: `created_at`, `updated_at`, `timestamptz`, always UTC.
- Enums as Postgres enum types or CHECK constraints, matching the TypeScript
  union types in `app/lib/definitions.ts` — one source of truth per concept.
- **Quarters not Seasons** (existing convention) applies to the schema too.
