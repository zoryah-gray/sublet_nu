// Shared fixtures for the auth tests: a real RSA key pair standing in for
// Cognito's signing key, token signers, and a fetch stub that plays Cognito's
// JWKS, /oauth2/token and /oauth2/revoke endpoints.

import { exportJWK, generateKeyPair, SignJWT, type JWTPayload } from 'jose';
import { vi } from 'vitest';

export const TEST_ENV = {
  COGNITO_DOMAIN: 'https://auth.test.example',
  COGNITO_CLIENT_ID: 'test-client-id',
  COGNITO_USER_POOL_ID: 'us-east-1_TestPool',
  COGNITO_REGION: 'us-east-1',
  APP_URL: 'http://localhost:3000',
};
export const ISSUER = `https://cognito-idp.${TEST_ENV.COGNITO_REGION}.amazonaws.com/${TEST_ENV.COGNITO_USER_POOL_ID}`;
const KID = 'test-key-1';

type KeyPair = Awaited<ReturnType<typeof generateKeyPair>>;
let cognitoKeys: KeyPair;
let attackerKeys: KeyPair;
let jwks: { keys: object[] };

/** Generates the stand-in Cognito key and an attacker key. Call once in beforeAll. */
export async function setupKeys(): Promise<void> {
  cognitoKeys = await generateKeyPair('RS256', { extractable: true });
  attackerKeys = await generateKeyPair('RS256', { extractable: true });
  jwks = { keys: [{ ...(await exportJWK(cognitoKeys.publicKey)), kid: KID, alg: 'RS256', use: 'sig' }] };
}

/** Sets the auth env vars for the module under test. */
export function stubAuthEnv(): void {
  for (const [name, value] of Object.entries(TEST_ENV)) vi.stubEnv(name, value);
}

/** Current time in whole seconds (respects fake timers). */
export const nowSeconds = (): number => Math.floor(Date.now() / 1000);

/** Signs a token with the Cognito key (or the attacker key). Input: claims, options. Output: compact JWT. */
async function sign(claims: JWTPayload, { attacker = false } = {}): Promise<string> {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: 'RS256', kid: KID })
    .sign(attacker ? attackerKeys.privateKey : cognitoKeys.privateKey);
}

/** Cognito-shaped access token. Input: claim overrides. Output: JWT. */
export function accessToken(overrides: JWTPayload = {}, options?: { attacker?: boolean }): Promise<string> {
  const iat = nowSeconds();
  return sign(
    { iss: ISSUER, sub: 'user-sub-1', client_id: TEST_ENV.COGNITO_CLIENT_ID, token_use: 'access', iat, exp: iat + 3600, ...overrides },
    options,
  );
}

/** Cognito-shaped ID token. Input: claim overrides (e.g. nonce). Output: JWT. */
export function idToken(overrides: JWTPayload = {}): Promise<string> {
  const iat = nowSeconds();
  return sign({
    iss: ISSUER, sub: 'user-sub-1', aud: TEST_ENV.COGNITO_CLIENT_ID, token_use: 'id', iat, exp: iat + 3600,
    email: 'ag2021@u.northwestern.edu', name: 'Ally Goodman', ...overrides,
  });
}

/** Re-encodes a JWT's payload without re-signing it. Input: token, claim changes. Output: tampered JWT. */
export function tamperPayload(token: string, changes: JWTPayload): string {
  const [header, payload, signature] = token.split('.');
  const claims = JSON.parse(Buffer.from(payload, 'base64url').toString());
  return [header, Buffer.from(JSON.stringify({ ...claims, ...changes })).toString('base64url'), signature].join('.');
}

export interface FetchCall {
  url: string;
  init?: RequestInit;
}

/**
 * Replaces global fetch with a fake Cognito. Input: token-endpoint responder.
 * Output: the recorded calls (JWKS fetches included).
 */
export function stubCognitoFetch(onToken: (body: URLSearchParams) => Response | Promise<Response> = () => new Response(null, { status: 500 })): FetchCall[] {
  const calls: FetchCall[] = [];
  vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = input instanceof Request ? input.url : input.toString();
    calls.push({ url, init });
    if (url.endsWith('/.well-known/jwks.json')) return Response.json(jwks);
    if (url === `${TEST_ENV.COGNITO_DOMAIN}/oauth2/token`) return onToken(new URLSearchParams(String(init?.body)));
    if (url === `${TEST_ENV.COGNITO_DOMAIN}/oauth2/revoke`) return new Response(null, { status: 200 });
    throw new Error(`Unexpected fetch: ${url}`);
  }));
  return calls;
}

/** Calls made to Cognito's token endpoint. */
export const tokenCalls = (calls: FetchCall[]): FetchCall[] =>
  calls.filter((c) => c.url === `${TEST_ENV.COGNITO_DOMAIN}/oauth2/token`);

/** Finds the Set-Cookie line for a cookie name. Input: headers, name. Output: line or undefined. */
export function setCookieLine(headers: Headers, name: string): string | undefined {
  return headers.getSetCookie().find((line) => line.startsWith(`${name}=`));
}
