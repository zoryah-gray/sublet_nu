import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as rds from 'aws-cdk-lib/aws-rds';
import { Construct } from 'constructs';
import { DeployEnvironment } from './auth-stack';
import { DB_NAME } from './data-stack';
import { MIGRATION_FUNCTIONS_RUNTIME, migrationFunctionCode } from './migration-function-code';

export interface MigrationStackProps extends cdk.StackProps {
  environment: DeployEnvironment;
  vpc: ec2.IVpc;
  dbInstance: rds.DatabaseInstance;
}

// Postgres role the runner logs in as. Created once by the bootstrap stack
// (lib/bootstrap-migrator-role-stack.ts); CREATE on schema public only.
const DB_MIGRATOR_USER = 'migrator_role';

/**
 * MigrationRunnerFn: applies pending db/migrations to RDS as migrator_role.
 * Invoke-only by design: no API, schedule or trigger can start a schema change.
 */
export class MigrationStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: MigrationStackProps) {
    super(scope, id, props);
    const { vpc, dbInstance } = props;

    cdk.Tags.of(this).add('Project', 'SubletNU');

    // Same network pattern as ProvisionUserFn: isolated subnets, outbound only to
    // the DB rule below (the IAM token is signed locally, no AWS API call).
    const migrationRunnerFn = new lambda.Function(this, 'MigrationRunnerFn', {
      runtime: MIGRATION_FUNCTIONS_RUNTIME,
      architecture: lambda.Architecture.X86_64,
      handler: 'migration_runner.handler',
      code: migrationFunctionCode('migration_runner.mjs', true),
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      allowAllOutbound: false,
      memorySize: 512,
      timeout: cdk.Duration.minutes(5),
      environment: {
        DB_HOST: dbInstance.dbInstanceEndpointAddress,
        DB_PORT: dbInstance.dbInstanceEndpointPort,
        DB_USER: DB_MIGRATOR_USER,
        DB_NAME,
      },
      // Longer than the trigger Lambdas: this is the record of every schema change.
      logGroup: new logs.LogGroup(this, 'MigrationRunnerFnLogs', {
        retention: logs.RetentionDays.ONE_MONTH,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
      }),
    });

    // allowTo, not dbInstance.connections.allowFrom: keeps the rule in this stack (no Data cycle).
    migrationRunnerFn.connections.allowTo(dbInstance, ec2.Port.tcp(5432), 'MigrationRunnerFn to Postgres');

    // IAM token for exactly migrator_role on exactly this instance. No Secrets
    // Manager access: this function never sees the master credentials.
    migrationRunnerFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['rds-db:connect'],
      resources: [`arn:aws:rds-db:${this.region}:${this.account}:dbuser:${dbInstance.instanceResourceId}/${DB_MIGRATOR_USER}`],
    }));

    new cdk.CfnOutput(this, 'MigrationRunnerFunctionName', { value: migrationRunnerFn.functionName });
  }
}
