#!/bin/sh
# Pipes a .sql file through psql inside the docker-compose `db` container.
#
#   npm run db:run -w apps/backend -- apps/backend/db/queries.sql
#   npm run db:run -w apps/backend -- apps/backend/db/queries.sql apps/backend/db/explain/before.txt
#
# Paths resolve relative to where you ran npm (usually the repo root), falling
# back to apps/backend/. With an output path, stdout and stderr both go to that
# file; otherwise they go to the terminal. psql variables ($POSTGRES_USER,
# $POSTGRES_DB) expand inside the container, which already has them from
# .env.local, so nothing needs sourcing on the host.
set -eu

if [ $# -lt 1 ]; then
  echo "usage: npm run db:run -w apps/backend -- <file.sql> [output.txt]" >&2
  exit 2
fi

package_dir=$PWD
cd "${INIT_CWD:-$PWD}"

input=$1
if [ ! -f "$input" ] && [ -f "$package_dir/$input" ]; then
  input=$package_dir/$input
fi
if [ ! -f "$input" ]; then
  echo "db:run: no such file: $1" >&2
  exit 2
fi

# -X skips ~/.psqlrc so output stays diffable; ON_ERROR_STOP makes the first
# failing statement abort the run with a non-zero exit instead of continuing.
run_psql() {
  docker compose exec -T db sh -c 'psql -X -v ON_ERROR_STOP=1 -P pager=off -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < "$input"
}

if [ $# -ge 2 ]; then
  mkdir -p "$(dirname "$2")"
  if run_psql > "$2" 2>&1; then
    echo "wrote $2"
  else
    status=$?
    echo "db:run: psql failed (exit $status); see $2" >&2
    exit $status
  fi
else
  run_psql
fi
