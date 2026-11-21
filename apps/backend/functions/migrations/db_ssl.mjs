import { readFileSync } from 'fs';

/**
 * TLS options for pg, equivalent to psycopg2's sslmode=verify-full in utils.get_db_connection:
 * the server cert must chain to the bundled RDS CA and match the hostname.
 * Output: pg `ssl` config.
 */
export function sslOptions() {
  return {
    ca: readFileSync(new URL('./rds-global-bundle.pem', import.meta.url), 'utf8'),
    rejectUnauthorized: true,
  };
}
