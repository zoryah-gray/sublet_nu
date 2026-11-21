// ============================================================================
// ONE-TIME BOOTSTRAP. Destroy SubletNU-BootstrapMigratorRole-<env> after use.
// ============================================================================
// BootstrapMigratorRoleFn: logs in as the RDS master user once and creates the
// two IAM-auth roles. Everything after this runs as migrator_role through
// MigrationRunnerFn. Invoked once from the console's Test button; the event is ignored.

import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import pg from 'pg';
import { sslOptions } from './db_ssl.mjs';

// [step label, SQL]. Static SQL only; labels are what gets logged.
// The app_user grant on users is NOT here: users doesn't exist until the first
// migration run, so the add-rds-iam-grant-guard migration grants it instead.
// postgis is created here because CREATE EXTENSION postgis needs rds_superuser,
// which migrator_role deliberately doesn't have.
const STEPS = [
  ['create app_user', 'CREATE ROLE app_user LOGIN'],
  ['grant rds_iam to app_user', 'GRANT rds_iam TO app_user'],
  ['create migrator_role', 'CREATE ROLE migrator_role LOGIN'],
  ['grant rds_iam to migrator_role', 'GRANT rds_iam TO migrator_role'],
  ['grant create on schema public to migrator_role', 'GRANT CREATE ON SCHEMA public TO migrator_role'],
  ['create extension postgis', 'CREATE EXTENSION IF NOT EXISTS postgis'],
];

/**
 * Reads the master username/password from the RDS-generated secret.
 * Output: { username, password }.
 */
async function masterCredentials() {
  const response = await new SecretsManagerClient({}).send(
    new GetSecretValueCommand({ SecretId: process.env.DB_SECRET_ARN }),
  );
  const { username, password } = JSON.parse(response.SecretString);
  return { username, password };
}

/**
 * Runs every bootstrap step as master in one transaction.
 * Input: ignored. Output: { completed: step labels }. Throws on any failure (nothing is kept).
 */
export const handler = async () => {
  const { username, password } = await masterCredentials();
  const client = new pg.Client({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    database: process.env.DB_NAME,
    user: username,
    password,
    ssl: sslOptions(),
    connectionTimeoutMillis: 5000,
  });

  let step = 'connect';
  try {
    await client.connect();
    await client.query('BEGIN');
    for (const [label, sql] of STEPS) {
      step = label;
      await client.query(sql);
    }
    await client.query('COMMIT');
    const completed = STEPS.map(([label]) => label);
    console.log(`Bootstrap steps applied: ${JSON.stringify(completed)}`);
    console.log('Bootstrap complete');
    return { completed };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    const pgcode = error?.code ?? 'none';
    const errorType = error?.constructor?.name ?? 'Error';
    console.error(`Bootstrap failed: step=${step} pgcode=${pgcode} type=${errorType}`);
    throw new Error(`Bootstrap failed at "${step}" (pgcode=${pgcode}, type=${errorType})`);
  } finally {
    await client.end().catch(() => {});
  }
};
