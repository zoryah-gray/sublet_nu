// MigrationRunnerFn: applies every pending migration bundled under ./migrations
// to RDS as migrator_role. Invoke-only (no event source); the event is ignored,
// so nothing a caller sends can choose which SQL runs or which files are read.

import { Signer } from '@aws-sdk/rds-signer';
import { runner } from 'node-pg-migrate';
import pg from 'pg';
import { fileURLToPath } from 'url';
import { sslOptions } from './db_ssl.mjs';

const MIGRATIONS_DIR = fileURLToPath(new URL('./migrations', import.meta.url));
// node-pg-migrate logs this header right before applying each migration.
const MIGRATION_HEADER = /^### MIGRATION (.+) \(UP\) ###$/;

/**
 * Builds a pg client that logs in as DB_USER with an IAM auth token (no password).
 * Output: unconnected pg.Client.
 */
async function iamClient() {
  const { DB_HOST, DB_PORT, DB_USER, DB_NAME, AWS_REGION } = process.env;
  const port = Number(DB_PORT);
  const token = await new Signer({ hostname: DB_HOST, port, username: DB_USER, region: AWS_REGION }).getAuthToken();
  return new pg.Client({
    host: DB_HOST,
    port,
    user: DB_USER,
    database: DB_NAME,
    password: token,
    ssl: sslOptions(),
    connectionTimeoutMillis: 15000,
  });
}

/**
 * Runs `node-pg-migrate up` for every pending migration in one transaction,
 * tracked in pgmigrations.
 * Input: ignored. Output: { applied: migration names }. Throws on any failure.
 */
export const handler = async () => {
  let current = null;
  // node-pg-migrate's own error/debug output includes raw SQL; only migration
  // names are kept from it.
  const logger = {
    info: (message) => {
      const match = MIGRATION_HEADER.exec(message);
      if (match) current = match[1];
    },
    warn: (message) => {
      if (message.includes('Need to break single transaction')) {
        console.warn(`Migration ${current} is not transactional; the single transaction is split here`);
      }
    },
    error: () => {},
  };

  const client = await iamClient();
  try {
    await client.connect();
    const applied = await runner({
      dbClient: client,
      dir: MIGRATIONS_DIR,
      migrationsTable: 'pgmigrations',
      direction: 'up',
      count: Infinity,
      // The CLI defaults this to true; the programmatic API does not.
      singleTransaction: true,
      checkOrder: true,
      logger,
    });
    const names = applied.map((migration) => migration.name);
    console.log(`Applied ${names.length} migration(s)`);
    console.log('Migration run complete');
    return { applied: names };
  } catch (error) {
    const pgcode = error?.code ?? 'none';
    const errorType = error?.constructor?.name ?? 'Error';
    if (current === null) {
      // TEMPORARY (see the diagnostic above): no migration has run, so no row
      // data can be in the message; log it in full to diagnose connection setup.
      console.error(`Migration setup failed: name=${error?.name} message=${error?.message} pgcode=${pgcode}`);
    } else {
      console.error(`Migration failed: migration=${current} pgcode=${pgcode} type=${errorType}`);
    }
    // A fresh error, so the invocation's error payload carries no statement text or row values.
    throw new Error(`Migration run failed at ${current ?? 'setup'} (pgcode=${pgcode}, type=${errorType})`);
  } finally {
    await client.end().catch(() => {});
  }
};
