# SubletNU backend

AWS CDK infrastructure stack, plus the Postgres schema and its migrations.

The `cdk.json` file tells the CDK Toolkit how to execute your app.

## Useful commands

* `npm run build`   compile typescript to js
* `npm run watch`   watch for changes and compile
* `npm run test`    perform the jest tests (needs `DATABASE_URL`, see below)
* `npx cdk deploy`  deploy this stack to your default AWS account/region
* `npx cdk diff`    compare deployed stack with current state
* `npx cdk synth`   emits the synthesized CloudFormation template

## Database

Migrations live in `db/migrations/` and are applied by
[node-pg-migrate](https://salsita.github.io/node-pg-migrate/) (see
`docs/adr/adr_6_migration_tooling.md`). `db/schema.sql` is a hand-maintained
snapshot of the schema after the latest migration. Keep it in sync.

**Rule:** migrations use `pgm.sql(...)` only, never `pgm.createTable()` or any
other DSL call.

### Local setup (from the repo root)

1. Copy the keys from `.env.example` into `.env.local`. Generate the password
   with `openssl rand -hex 24` (hex, because base64 characters like `/` break
   `DATABASE_URL`). `DATABASE_URL` is required: node-pg-migrate and jest run on
   your machine, not in a container, so they can't use the URL docker-compose
   builds for the `dev` container (its host `db` only resolves on the compose
   network). Write it in terms of the other keys so the password lives in one
   place — `source` expands it (and set `POSTGRES_PORT=5432`, which compose
   also uses for the published port; if it's missing the URL has no port):
   `DATABASE_URL=postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@localhost:${POSTGRES_PORT}/${POSTGRES_DB}`
2. Start Postgres: `docker compose --env-file .env.local up -d db`
3. Load the env into your shell (**every new terminal**, before any command in
   the table below): `set -a && source .env.local && set +a`
4. Run the migrations and tests:

| Command | What it does |
| --- | --- |
| `npm run migrate:up -w apps/backend` | apply every pending migration |
| `npm run migrate:down -w apps/backend` | revert the most recent migration |
| `npm run migrate:down:all -w apps/backend` | revert every migration (`down 0 --timestamp`) |
| `npm run migrate:create -w apps/backend -- <name>` | new `.mjs` migration from the template |
| `npm test -w apps/backend` | jest, including the DB tests in `test/db/` |

`docker compose down` keeps the data volume; `docker compose down -v` wipes it.

The `db` service runs `postgis/postgis:17-3.5-alpine` (Postgres 17 + PostGIS
3.5, matching RDS). PostGIS is available but **not installed** — migrations
enable it, as they must on RDS. The image is amd64-only, so on Apple Silicon it
runs under Rosetta: plan shapes and `Buffers:` counts are reliable, absolute
milliseconds are not.

### Query analysis (EXPLAIN ANALYZE)

Unlike the migration and test commands above, **these three** don't need
`.env.local` sourced: psql runs inside the `db` container, which already has
`POSTGRES_USER` / `POSTGRES_DB`. The database still needs its schema first —
`db:seed` fails with `relation "users" does not exist` on a fresh volume until
the migrations have run.

| Command | What it does |
| --- | --- |
| `npm run db:psql -w apps/backend` | interactive psql in the `db` container |
| `npm run db:seed -w apps/backend` | load `db/seeds/seed-browse.sql`: ~5,000 reproducible sublets (re-runnable; only replaces its own `@seed.subletnu.invalid` rows), then `ANALYZE` |
| `npm run db:run -w apps/backend -- <file.sql>` | pipe any SQL file through psql, output to the terminal |
| `npm run db:run -w apps/backend -- <file.sql> <out.txt>` | same, stdout + stderr written to `<out.txt>` (for before/after diffs) |

- File paths resolve from where you ran npm (usually the repo root), falling
  back to `apps/backend/`.
- Pass the output path as the second argument rather than redirecting with
  `>`: without `--silent`, npm prints its own header to stdout, which would end
  up in the file.
- psql runs with `-X` (ignores `~/.psqlrc`, so output stays diffable) and
  `ON_ERROR_STOP` (first failing statement aborts with a non-zero exit).
- A different seed size: `docker compose exec -T db sh -c 'psql -X -v ON_ERROR_STOP=1 -v rows=50000 -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < apps/backend/db/seeds/seed-browse.sql`.
  At 5,000 rows `sublets` is only ~384 heap pages, so the planner correctly
  seq-scans unselective predicates; larger sizes move the crossover points.
- Committed EXPLAIN output lives in `db/explain/`.
