// ============================================================================
// ONE-TIME STACK. DESTROY AFTER USE.
// ============================================================================
// Deploy once (only with -c bootstrapMigrator=true), invoke BootstrapMigratorRoleFn
// once from the Lambda console's Test button, confirm app_user and migrator_role
// exist, then:
//   npx cdk destroy SubletNU-BootstrapMigratorRole-<env> -c environment=<env> -c bootstrapMigrator=true
// Destroy BEFORE removing this stack from bin/backend.ts: it imports DataStack
// exports, and DataStack can't drop an export that's still in use.
//
// While it exists, this is the only thing in the account that can read the RDS
// master password, and its Secrets Manager endpoint costs ~$0.01/hour.
// ============================================================================

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

export interface BootstrapMigratorRoleStackProps extends cdk.StackProps {
  environment: DeployEnvironment;
  vpc: ec2.IVpc;
  dbInstance: rds.DatabaseInstance;
}

/**
 * Temporary: BootstrapMigratorRoleFn creates app_user and migrator_role as the
 * RDS master user, plus a Secrets Manager endpoint so it can read that password
 * from the isolated subnets.
 */
export class BootstrapMigratorRoleStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: BootstrapMigratorRoleStackProps) {
    super(scope, id, props);
    const { vpc, dbInstance } = props;

    cdk.Tags.of(this).add('Project', 'SubletNU');

    const masterSecret = dbInstance.secret;
    if (!masterSecret) throw new Error('dbInstance has no generated master secret');

    // The isolated subnets have no route to the Secrets Manager API (no NAT).
    // One subnet only: halves the hourly cost; private DNS resolves VPC-wide.
    // No outbound rules: SGs are stateful, so replies to the Lambda's inbound 443
    // connection are allowed without one. The default would allow all egress.
    const secretsEndpointSg = new ec2.SecurityGroup(this, 'SecretsManagerEndpointSg', {
      vpc,
      allowAllOutbound: false,
      description: 'Secrets Manager endpoint for the one-time bootstrap Lambda',
    });

    const secretsEndpoint = new ec2.InterfaceVpcEndpoint(this, 'SecretsManagerEndpoint', {
      vpc,
      service: ec2.InterfaceVpcEndpointAwsService.SECRETS_MANAGER,
      subnets: { subnets: [vpc.isolatedSubnets[0]] },
      privateDnsEnabled: true,
      open: false,
      securityGroups: [secretsEndpointSg],
    });

    const bootstrapFn = new lambda.Function(this, 'BootstrapMigratorRoleFn', {
      runtime: MIGRATION_FUNCTIONS_RUNTIME,
      architecture: lambda.Architecture.X86_64,
      handler: 'bootstrap_migrator_role.handler',
      code: migrationFunctionCode('bootstrap_migrator_role.mjs', false),
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      allowAllOutbound: false,
      memorySize: 256,
      timeout: cdk.Duration.seconds(30),
      environment: {
        DB_HOST: dbInstance.dbInstanceEndpointAddress,
        DB_PORT: dbInstance.dbInstanceEndpointPort,
        DB_NAME,
        DB_SECRET_ARN: masterSecret.secretArn,
      },
      logGroup: new logs.LogGroup(this, 'BootstrapMigratorRoleFnLogs', {
        retention: logs.RetentionDays.ONE_WEEK,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
      }),
    });

    bootstrapFn.connections.allowTo(dbInstance, ec2.Port.tcp(5432), 'BootstrapMigratorRoleFn to Postgres');
    bootstrapFn.connections.allowTo(secretsEndpoint, ec2.Port.tcp(443), 'BootstrapMigratorRoleFn to Secrets Manager');

    // Exactly one action on exactly the master secret (not grantRead, which adds DescribeSecret).
    bootstrapFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['secretsmanager:GetSecretValue'],
      resources: [masterSecret.secretArn],
    }));

    new cdk.CfnOutput(this, 'BootstrapFunctionName', { value: bootstrapFn.functionName });
  }
}
