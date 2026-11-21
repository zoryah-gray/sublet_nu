import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import { Construct } from 'constructs';

export const DB_NAME = 'subletnu';

/**
 * Network + Postgres for SubletNU: an isolated-subnet VPC (no NAT, no internet
 * route) and a single-AZ db.t4g.micro instance. Lambdas connect directly to the
 * instance endpoint with IAM auth; RDS Proxy is deferred to the production phase.
 */
export class DataStack extends cdk.Stack {
  readonly vpc: ec2.Vpc;
  readonly dbInstance: rds.DatabaseInstance;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    cdk.Tags.of(this).add('Project', 'SubletNU');

    // Two AZs only because an RDS subnet group requires subnets in at least two.
    this.vpc = new ec2.Vpc(this, 'Vpc', {
      maxAzs: 2,
      natGateways: 0,
      // true adds a custom-resource Lambda whose log group never expires (CLAUDE.md rule 3).
      // Nothing attaches to the default SG and the subnets have no internet route.
      restrictDefaultSecurityGroup: false,
      subnetConfiguration: [{
        name: 'private-isolated',
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        cidrMask: 24,
      }],
    });

    const dbSecurityGroup = new ec2.SecurityGroup(this, 'DatabaseSecurityGroup', {
      vpc: this.vpc,
      allowAllOutbound: false,
      description: 'SubletNU RDS instance',

    });

    this.dbInstance = new rds.DatabaseInstance(this, 'Database', {
      engine: rds.DatabaseInstanceEngine.postgres({ version: rds.PostgresEngineVersion.VER_17 }),
      vpc: this.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T4G, ec2.InstanceSize.MICRO),
      databaseName: DB_NAME,
      iamAuthentication: true,
      // gp3 under 400 GiB gets the 3,000 IOPS / 125 MiBps baseline free; iops/storageThroughput stay unset.
      allocatedStorage: 20,
      storageType: rds.StorageType.GP3,
      // Holds student PII. Can't be turned on later without a snapshot-restore replacement.
      storageEncrypted: true,
      multiAz: false,
      publiclyAccessible: false,
      backupRetention: cdk.Duration.days(7),
      removalPolicy: cdk.RemovalPolicy.SNAPSHOT,
      deletionProtection: true,
      securityGroups: [dbSecurityGroup],
    });
  }
}
