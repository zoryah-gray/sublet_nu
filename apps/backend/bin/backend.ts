#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib/core';
import { BackendStack } from '../lib/backend-stack';
import { DataStack } from '../lib/data-stack';
import { AuthStack, DeployEnvironment } from '../lib/auth-stack';

const app = new cdk.App();

// Every stack deploys to us-east-2: the CDK bootstrap and the Google client
// id/secret (SSM + Secrets Manager, both regional) live there. The account comes
// from the CLI credentials in use.
const env: cdk.Environment = { account: process.env.CDK_DEFAULT_ACCOUNT, region: 'us-east-2' };

new BackendStack(app, 'BackendStack', { env });

// Required, no default: a missing value must not deploy dev settings (gmail
// sign-ups, localhost callbacks) into the production account.
const environment = app.node.tryGetContext('environment') ?? process.env.ENVIRONMENT;
if (environment !== 'dev' && environment !== 'prod') {
  throw new Error('Set environment via -c environment=dev|prod or the ENVIRONMENT env var');
}

const data = new DataStack(app, `SubletNU-Data-${environment}`, { env });
new AuthStack(app, `SubletNU-Auth-${environment}`, {
  env,
  environment: environment as DeployEnvironment,
  vpc: data.vpc,
  dbInstance: data.dbInstance,
});
