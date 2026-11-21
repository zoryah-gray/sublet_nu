// ============================================================================
// THROWAWAY STACK. DESTROY AFTER USE.
// ============================================================================
// Deploy only with -c usersTableCheck=true, invoke UsersTableCheckFn (read the
// rows in the response) or UsersTableResetFn (empties users) from the Lambda
// console's Test button, then:
//   npx cdk destroy SubletNU-UsersTableCheck-<env> -c environment=<env> -c usersTableCheck=true
// Destroy BEFORE removing this stack from bin/backend.ts: it imports Data and
// Auth stack exports, and those stacks can't drop an export that's still in use.
//
// The response contains real PII (email, full_name); the function never logs it.
// ============================================================================

import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as rds from 'aws-cdk-lib/aws-rds';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { Construct } from 'constructs';
import { DB_IAM_USER, DeployEnvironment } from './auth-stack';
import { DB_NAME } from './data-stack';
import { DB_MIGRATOR_USER } from './migration-stack';

export interface UsersTableCheckStackProps extends cdk.StackProps {
  environment: DeployEnvironment;
  vpc: ec2.IVpc;
  dbInstance: rds.DatabaseInstance;
  utilsLayer: lambda.ILayerVersion;
}

const CHECKS_DIR = path.join(__dirname, '../functions/checks');
const HANDLER_FILES = ['users_table_check.py', 'users_table_reset.py'];

/**
 * Temporary: UsersTableCheckFn returns the 5 newest users rows, read as app_user,
 * to confirm PostConfirmation provisioning end to end. UsersTableResetFn truncates
 * users as migrator_role, so sign-up can be retested from scratch.
 */
export class UsersTableCheckStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: UsersTableCheckStackProps) {
    super(scope, id, props);
    const { vpc, dbInstance, utilsLayer } = props;

    cdk.Tags.of(this).add('Project', 'SubletNU');

    // Same bundling as ProvisionUserFn: psycopg2-binary isn't in the utils layer.
    const code = lambda.Code.fromAsset(CHECKS_DIR, {
      exclude: ['**/__pycache__', '**/*.pyc', '**/.DS_Store'],
      bundling: {
        image: lambda.Runtime.PYTHON_3_12.bundlingImage,
        platform: 'linux/amd64',
        command: ['bash', '-c', `pip install -r requirements.txt -t /asset-output && cp ${HANDLER_FILES.join(' ')} /asset-output`],
        local: {
          tryBundle(outputDir: string): boolean {
            try {
              execSync(
                `python3 -m pip install -r requirements.txt -t "${outputDir}" --platform manylinux2014_x86_64 ` +
                  '--implementation cp --python-version 3.12 --only-binary=:all: --no-cache-dir --quiet',
                { cwd: CHECKS_DIR, stdio: 'inherit' },
              );
              for (const file of HANDLER_FILES) fs.copyFileSync(path.join(CHECKS_DIR, file), path.join(outputDir, file));
              return true;
            } catch {
              return false;
            }
          },
        },
      },
    });

    // Invoke-only; the event is ignored, so a caller can't change the query.
    const usersTableCheckFn = new lambda.Function(this, 'UsersTableCheckFn', {
      runtime: lambda.Runtime.PYTHON_3_12,
      architecture: lambda.Architecture.X86_64,
      handler: 'users_table_check.lambda_handler',
      code,
      layers: [utilsLayer],
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      allowAllOutbound: false,
      memorySize: 256,
      timeout: cdk.Duration.seconds(15),
      environment: {
        DB_HOST: dbInstance.dbInstanceEndpointAddress,
        DB_PORT: dbInstance.dbInstanceEndpointPort,
        DB_USER: DB_IAM_USER,
        DB_NAME,
      },
      logGroup: new logs.LogGroup(this, 'UsersTableCheckFnLogs', {
        retention: logs.RetentionDays.ONE_WEEK,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
      }),
    });

    usersTableCheckFn.connections.allowTo(dbInstance, ec2.Port.tcp(5432), 'UsersTableCheckFn to Postgres');

    // IAM token for exactly app_user on exactly this instance; no Secrets Manager access.
    usersTableCheckFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['rds-db:connect'],
      resources: [`arn:aws:rds-db:${this.region}:${this.account}:dbuser:${dbInstance.instanceResourceId}/${DB_IAM_USER}`],
    }));

    new cdk.CfnOutput(this, 'UsersTableCheckFunctionName', { value: usersTableCheckFn.functionName });

    // Invoke-only; the event is ignored, so a caller can't change the statement.
    // migrator_role, not app_user: it owns users, so it can TRUNCATE with no new grant.
    const usersTableResetFn = new lambda.Function(this, 'UsersTableResetFn', {
      runtime: lambda.Runtime.PYTHON_3_12,
      architecture: lambda.Architecture.X86_64,
      handler: 'users_table_reset.lambda_handler',
      code,
      layers: [utilsLayer],
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      allowAllOutbound: false,
      memorySize: 256,
      timeout: cdk.Duration.seconds(15),
      environment: {
        DB_HOST: dbInstance.dbInstanceEndpointAddress,
        DB_PORT: dbInstance.dbInstanceEndpointPort,
        DB_USER: DB_MIGRATOR_USER,
        DB_NAME,
      },
      logGroup: new logs.LogGroup(this, 'UsersTableResetFnLogs', {
        retention: logs.RetentionDays.ONE_WEEK,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
      }),
    });

    usersTableResetFn.connections.allowTo(dbInstance, ec2.Port.tcp(5432), 'UsersTableResetFn to Postgres');

    // Same pattern as MigrationRunnerFn: IAM token for exactly migrator_role on exactly this instance.
    usersTableResetFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['rds-db:connect'],
      resources: [`arn:aws:rds-db:${this.region}:${this.account}:dbuser:${dbInstance.instanceResourceId}/${DB_MIGRATOR_USER}`],
    }));

    new cdk.CfnOutput(this, 'UsersTableResetFunctionName', { value: usersTableResetFn.functionName });
  }
}
