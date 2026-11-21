import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { execSync } from 'child_process';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

export const MIGRATION_FUNCTIONS_RUNTIME = lambda.Runtime.NODEJS_24_X;

const FUNCTION_DIR = path.join(__dirname, '../functions/migrations');
const MIGRATIONS_DIR = path.join(__dirname, '../db/migrations');
// Same public RDS CA bundle the Python layer uses for verify-full.
const CA_BUNDLE = path.join(__dirname, '../functions/layer/python/rds-global-bundle.pem');

const SHARED_FILES = ['package.json', 'package-lock.json', 'db_ssl.mjs'];

/** Migration files only (node-pg-migrate's own filter skips dotfiles too). */
function migrationFiles(): string[] {
  return fs.readdirSync(MIGRATIONS_DIR).filter((name) => /^\d+_.+\.mjs$/.test(name)).sort();
}

/**
 * Hash of everything that ends up in the zip, so a changed migration or
 * dependency always produces a new asset (the source dir alone misses db/migrations).
 */
function contentHash(handlerFile: string, includeMigrations: boolean): string {
  const hash = crypto.createHash('sha256');
  const files = [...SHARED_FILES, handlerFile].map((name) => path.join(FUNCTION_DIR, name));
  files.push(CA_BUNDLE);
  if (includeMigrations) files.push(...migrationFiles().map((name) => path.join(MIGRATIONS_DIR, name)));
  for (const file of files) {
    hash.update(path.basename(file));
    hash.update(fs.readFileSync(file));
  }
  return hash.digest('hex');
}

/**
 * Lambda code for a handler in functions/migrations: the handler, db_ssl.mjs,
 * the RDS CA bundle, production npm dependencies (npm ci from the committed
 * lockfile) and, for the runner, a copy of db/migrations.
 * Input: handler file name, whether to bundle migrations. Output: lambda.Code.
 */
export function migrationFunctionCode(handlerFile: string, includeMigrations: boolean): lambda.Code {
  const copyInto = (outputDir: string): void => {
    for (const name of [...SHARED_FILES, handlerFile]) {
      fs.copyFileSync(path.join(FUNCTION_DIR, name), path.join(outputDir, name));
    }
    fs.copyFileSync(CA_BUNDLE, path.join(outputDir, 'rds-global-bundle.pem'));
    if (includeMigrations) {
      fs.mkdirSync(path.join(outputDir, 'migrations'));
      for (const name of migrationFiles()) {
        fs.copyFileSync(path.join(MIGRATIONS_DIR, name), path.join(outputDir, 'migrations', name));
      }
    }
  };

  const npmCi = 'npm ci --omit=dev --ignore-scripts --no-audit --no-fund';
  // Docker fallback: same steps, with db/migrations and the CA bundle mounted in.
  const dockerCommand = [
    `cp ${[...SHARED_FILES, handlerFile].join(' ')} /asset-output/`,
    'cp /ca/rds-global-bundle.pem /asset-output/',
    includeMigrations ? 'mkdir /asset-output/migrations && cp /migrations/*_*.mjs /asset-output/migrations/' : 'true',
    `cd /asset-output && HOME=/tmp ${npmCi}`,
  ].join(' && ');

  return lambda.Code.fromAsset(FUNCTION_DIR, {
    assetHashType: cdk.AssetHashType.CUSTOM,
    assetHash: contentHash(handlerFile, includeMigrations),
    bundling: {
      image: MIGRATION_FUNCTIONS_RUNTIME.bundlingImage,
      command: ['bash', '-c', dockerCommand],
      volumes: [
        { hostPath: MIGRATIONS_DIR, containerPath: '/migrations' },
        { hostPath: path.dirname(CA_BUNDLE), containerPath: '/ca' },
      ],
      local: {
        tryBundle(outputDir: string): boolean {
          try {
            copyInto(outputDir);
            // Pure-JS dependencies only, so a local install matches Lambda's platform.
            execSync(npmCi, { cwd: outputDir, stdio: 'inherit' });
            return true;
          } catch {
            return false;
          }
        },
      },
    },
  });
}
