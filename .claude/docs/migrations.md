# Migration Rules

**Every migration must be safe to run while the previous version of the app is
still serving traffic.** During a deploy, old and new code run simultaneously.

## Expand/contract — the only pattern used here

Renaming or dropping a column in one step breaks in-flight requests. Instead:

1. **Expand** — add the new column, nullable, no constraint. Deploy.
2. **Backfill** — populate it in batches. Deploy nothing.
3. **Dual-write** — new code writes both columns, reads the old. Deploy.
4. **Switch reads** — new code reads the new column. Deploy.
5. **Contract** — drop the old column. Deploy.

Each step is its own PR and its own deploy. Steps 1 and 5 are never in the same PR.

## Always

- Every migration has a tested `down`.
- No migration holds a lock on a large table without a `lock_timeout`.
- Adding an index on a populated table uses `CREATE INDEX CONCURRENTLY`.
- Adding a `NOT NULL` column with a default is safe on modern Postgres; adding
  `NOT NULL` to an existing column requires a validated CHECK constraint first.
- Migrations are reviewed against the currently deployed schema, not against main.
