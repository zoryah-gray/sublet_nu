// Cognito settings for the hosted-UI login. Server-side only (read in proxy.ts,
// Route Handlers and the DAL); none of these are secrets, since the app client
// is public and uses PKCE. Values come from the SubletNU-Auth-<env> stack outputs.

export interface AuthConfig {
  /** Hosted UI base URL, e.g. https://subletnu-dev-26611.auth.us-east-2.amazoncognito.com */
  cognitoDomain: string;
  clientId: string;
  userPoolId: string;
  region: string;
  /** This app's origin; must match the Cognito client's callback/logout URLs exactly. */
  appUrl: string;
}

/** Reads the auth env vars. Output: AuthConfig. Throws naming the first missing variable. */
export function getAuthConfig(): AuthConfig {
  const read = (name: string): string => {
    const value = process.env[name];
    if (!value) throw new Error(`${name} is not set — see .env.example (Cognito auth)`);
    return value.replace(/\/$/, '');
  };
  return {
    cognitoDomain: read('COGNITO_DOMAIN'),
    clientId: read('COGNITO_CLIENT_ID'),
    userPoolId: read('COGNITO_USER_POOL_ID'),
    region: read('COGNITO_REGION'),
    appUrl: read('APP_URL'),
  };
}

/** Token issuer for the user pool. Input: config. Output: the `iss` every Cognito token must carry. */
export function issuerFor(config: AuthConfig): string {
  return `https://cognito-idp.${config.region}.amazonaws.com/${config.userPoolId}`;
}

/** Callback Route Handler URL registered as the Cognito client's callbackUrl. */
export function callbackUrlFor(config: AuthConfig): string {
  return `${config.appUrl}/api/auth/callback/cognito`;
}
