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
   `DATABASE_URL`), and use the same password inside `DATABASE_URL` (host `localhost`).
2. Start Postgres: `docker compose --env-file .env.local up -d db`
3. Load the env into your shell: `set -a && source .env.local && set +a`
4. Run the migrations and tests:

| Command | What it does |
| --- | --- |
| `npm run migrate:up -w apps/backend` | apply every pending migration |
| `npm run migrate:down -w apps/backend` | revert the most recent migration |
| `npm run migrate:down:all -w apps/backend` | revert every migration (`down 0 --timestamp`) |
| `npm run migrate:create -w apps/backend -- <name>` | new `.mjs` migration from the template |
| `npm test -w apps/backend` | jest, including the DB tests in `test/db/` |

`docker compose down` keeps the data volume; `docker compose down -v` wipes it.
