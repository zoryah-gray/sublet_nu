import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { Construct } from 'constructs';

export type DeployEnvironment = 'dev' | 'prod';

export interface AuthStackProps extends cdk.StackProps {
  environment: DeployEnvironment;
  vpc: ec2.IVpc;
  dbInstance: rds.DatabaseInstance;
}

// Postgres role the provisioning Lambda logs in as. Created by hand, not by a
// migration (rds_iam only exists on RDS) — see docs/onboarding/backend.md.
const DB_IAM_USER = 'app_user';
const DB_NAME = 'subletnu';

// Local test runs and Finder leave these in functions/; they must not ship to Lambda.
const PACKAGING_JUNK = ['**/__pycache__', '**/*.pyc', '**/.DS_Store'];

// Cognito only accepts plain http for localhost. Both point at the frontend's
// callback Route Handler, which exchanges the code for tokens and then redirects to /browse.
const APP_ORIGINS: Record<DeployEnvironment, string> = {
  dev: 'http://localhost:3000',
  prod: 'https://sublet-nu.vercel.app',
};

/**
 * Cognito user pool with Google as the only identity provider (Authorization
 * Code + PKCE), plus its two triggers: PreSignUp (domain gate) and
 * PostConfirmation (creates the users row in RDS).
 */
export class AuthStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: AuthStackProps) {
    super(scope, id, props);
    const { environment, vpc, dbInstance } = props;

    cdk.Tags.of(this).add('Project', 'SubletNU');

    const utilsLayer = new lambda.LayerVersion(this, 'UtilsLayer', {
      // The directory containing python/, so Lambda extracts it to /opt/python.
      code: lambda.Code.fromAsset(path.join(__dirname, '../functions/layer'), { exclude: PACKAGING_JUNK }),
      compatibleRuntimes: [lambda.Runtime.PYTHON_3_12],
      compatibleArchitectures: [lambda.Architecture.X86_64],
      description: 'SubletNU shared Python helpers (DB connection, derived fields)',
    });

    const authDir = path.join(__dirname, '../functions/auth');

    // Standard library only, so no bundling: the zip holds just this one file.
    const authDomainCode = lambda.Code.fromAsset(authDir, {
      exclude: ['*', '!pre_sign_up.py'],
    });

    // Bundled with requirements.txt (psycopg2-binary). Local pip with --platform
    // fetches Lambda's x86_64 manylinux wheels without Docker; Docker is the fallback.
    const provisionUserCode = lambda.Code.fromAsset(authDir, {
      exclude: ['pre_sign_up.py', ...PACKAGING_JUNK],
      bundling: {
        image: lambda.Runtime.PYTHON_3_12.bundlingImage,
        platform: 'linux/amd64',
        command: ['bash', '-c', 'pip install -r requirements.txt -t /asset-output && cp post_confirmation.py /asset-output'],
        local: {
          tryBundle(outputDir: string): boolean {
            try {
              execSync(
                `python3 -m pip install -r requirements.txt -t "${outputDir}" --platform manylinux2014_x86_64 ` +
                  '--implementation cp --python-version 3.12 --only-binary=:all: --no-cache-dir --quiet',
                { cwd: authDir, stdio: 'inherit' },
              );
              fs.copyFileSync(path.join(authDir, 'post_confirmation.py'), path.join(outputDir, 'post_confirmation.py'));
              return true;
            } catch {
              return false;
            }
          },
        },
      },
    });

    const authDomainFn = new lambda.Function(this, 'AuthDomainFn', {
      runtime: lambda.Runtime.PYTHON_3_12,
      architecture: lambda.Architecture.X86_64,
      handler: 'pre_sign_up.lambda_handler',
      code: authDomainCode,
      timeout: cdk.Duration.seconds(3),
      environment: {
        ENVIRONMENT: environment,
      },
      logGroup: new logs.LogGroup(this, 'AuthDomainFnLogs', {
        retention: logs.RetentionDays.ONE_WEEK,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
      }),
    });

    // In the VPC because RDS is only reachable there. Outbound is limited to
    // the DB rule below; nothing else is needed (the IAM token is signed locally).
    const provisionUserFn = new lambda.Function(this, 'ProvisionUserFn', {
      runtime: lambda.Runtime.PYTHON_3_12,
      architecture: lambda.Architecture.X86_64,
      handler: 'post_confirmation.lambda_handler',
      code: provisionUserCode,
      layers: [utilsLayer],
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      allowAllOutbound: false,
      memorySize: 256,
      // Cognito abandons a trigger after 5 s regardless of the Lambda timeout.
      timeout: cdk.Duration.seconds(5),
      environment: {
        DB_HOST: dbInstance.dbInstanceEndpointAddress, // switch back to proxy.endpoint when proxy is configured
        DB_PORT: dbInstance.dbInstanceEndpointPort,
        DB_USER: DB_IAM_USER,
        DB_NAME: DB_NAME,
      },
      logGroup: new logs.LogGroup(this, 'ProvisionUserFnLogs', {
        retention: logs.RetentionDays.ONE_WEEK,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
      }),
    });

    // SG-to-SG: DB ingress on 5432 from this function's security group only.
    // allowTo (not dbInstance.connections.allowFrom) so the rule lives in this
    // stack; allowFrom puts it in DataStack and creates a cross-stack cycle.
    provisionUserFn.connections.allowTo(dbInstance, ec2.Port.tcp(5432), 'ProvisionUserFn to Postgres');

    // Lambda -> RDS direction: lets the execution role mint IAM auth tokens for
    // exactly one DB user on exactly this instance (db- resource ID, not a proxy's prx-).
    provisionUserFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['rds-db:connect'],
      resources: [`arn:aws:rds-db:${this.region}:${this.account}:dbuser:${dbInstance.instanceResourceId}/${DB_IAM_USER}`],
    }));

    const userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: `subletnu-user-pool-${environment}`,
      signInAliases: { email: true },
      autoVerify: { email: true },
      standardAttributes: {
        // Immutable: the stored email is the Google-verified one and can't be changed.
        // Cognito only rewrites mapped attributes when the value changes, so sign-in
        // fails only if the user's Google email itself changes (AWS attribute-mapping docs).
        email: { required: true, mutable: false },
      },
      lambdaTriggers: {
        preSignUp: authDomainFn,
        postConfirmation: provisionUserFn,
      },
      // No passwords exist (Google only), so there's nothing to recover.
      accountRecovery: cognito.AccountRecovery.NONE,
      // The pool maps every users.cognito_sub; deleting it orphans every account.
      deletionProtection: environment === 'prod',
    });

    const userPoolDomain = userPool.addDomain('HostedDomain', {
      cognitoDomain: {
        domainPrefix: `subletnu-${environment}-26611`,
      },
    });

    // Google Auth secrets via dynamic references, resolved at deploy time; never in the template.
    const googleClientId = ssm.StringParameter.valueForStringParameter(this, '/subletnu/google-client-id');
    const googleClientSecret = cdk.SecretValue.secretsManager('subletnu/google-client-secret', {
      jsonField: 'GoogleClientSecret',
    });

    const googleProvider = new cognito.UserPoolIdentityProviderGoogle(this, 'Google', {
      userPool,
      clientId: googleClientId,
      clientSecretValue: googleClientSecret,
      // profile is what makes Google return name / given_name / family_name.
      scopes: ['openid', 'email', 'profile'],
      attributeMapping: {
        email: cognito.ProviderAttribute.GOOGLE_EMAIL,
        emailVerified: cognito.ProviderAttribute.GOOGLE_EMAIL_VERIFIED,
        fullname: cognito.ProviderAttribute.GOOGLE_NAME,
        givenName: cognito.ProviderAttribute.GOOGLE_GIVEN_NAME,
        familyName: cognito.ProviderAttribute.GOOGLE_FAMILY_NAME,
      },
    });

    // Public client (no secret): the frontend must use PKCE.
    const client = userPool.addClient('WebClient', {
      userPoolClientName: `subletnu-client-${environment}`,
      generateSecret: false,
      supportedIdentityProviders: [cognito.UserPoolClientIdentityProvider.GOOGLE],
      // A non-empty authFlows with every flow off leaves only ALLOW_REFRESH_TOKEN_AUTH.
      // The default would also enable SRP and custom auth, which this pool never uses.
      authFlows: { userSrp: false },
      enableTokenRevocation: true,
      preventUserExistenceErrors: true,
      // Explicit so the integration test can assert token exp - iat against it.
      accessTokenValidity: cdk.Duration.hours(1),
      idTokenValidity: cdk.Duration.hours(1),
      // Students re-login after 5 days; the frontend session cookies use the same max-age.
      refreshTokenValidity: cdk.Duration.days(5),
      oAuth: {
        flows: {
          authorizationCodeGrant: true,
        },
        scopes: [cognito.OAuthScope.OPENID, cognito.OAuthScope.EMAIL, cognito.OAuthScope.PROFILE],
        callbackUrls: [`${APP_ORIGINS[environment]}/api/auth/callback/cognito`],
        logoutUrls: [`${APP_ORIGINS[environment]}/`],
      },
    });
    // The client can't list GOOGLE until the provider exists.
    client.node.addDependency(googleProvider);

    new cdk.CfnOutput(this, 'CognitoDomainUrl', { value: userPoolDomain.baseUrl() });
    new cdk.CfnOutput(this, 'UserPoolId', { value: userPool.userPoolId });
    new cdk.CfnOutput(this, 'UserPoolClientId', { value: client.userPoolClientId });
  }
}
