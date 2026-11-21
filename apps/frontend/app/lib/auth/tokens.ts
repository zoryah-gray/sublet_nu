import { createRemoteJWKSet, errors, jwtVerify, type JWTPayload, type JWTVerifyGetKey } from 'jose';
import { issuerFor, type AuthConfig } from './config';

export type AccessTokenResult =
  | { status: 'valid'; claims: JWTPayload }
  | { status: 'expired' }
  | { status: 'invalid' };

const keySets = new Map<string, JWTVerifyGetKey>();

/**
 * Cognito's public signing keys (JWKS) for the pool. 
 * Input: config. 
 * Output: key resolver.
 *
 * One resolver per pool per server instance. jose caches the key set in memory
 * (cacheMaxAge), refetches early only for an unknown `kid` (Cognito key rotation),
 * and at most once per cooldownDuration, so forged `kid`s can't trigger a fetch
 * storm. This cache is separate from Next's fetch and route caches.
 */
export function cognitoKeySet(config: AuthConfig): JWTVerifyGetKey {
  const issuer = issuerFor(config);
  let keySet = keySets.get(issuer);
  if (!keySet) {
    keySet = createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`), {
      cacheMaxAge: 10 * 60 * 1000,
      cooldownDuration: 30 * 1000,
      // Fail fast: proxy.ts blocks the request while this runs.
      timeoutDuration: 3000,
    });
    keySets.set(issuer, keySet);
  }
  return keySet;
}

/** True if the claims are an access token for this app client. */
function isOurAccessToken(claims: JWTPayload | undefined, config: AuthConfig): boolean {
  return claims?.token_use === 'access' && claims.client_id === config.clientId;
}

/**
 * Verifies a Cognito access token. Input: token, config. Output: valid (with claims), expired, or invalid.
 *
 * Checked in order: RS256 signature against this pool's keys, `iss` pinned to this
 * pool, required claims present, `exp`, then `token_use` and `client_id` pinned to
 * this app client. Cognito access tokens carry no `aud`; `client_id` is their audience.
 * `expired` is returned only for a correctly signed, correctly issued token for this
 * client whose exp has passed (exp equal to now counts), the one case where a
 * refresh is allowed. Everything else is `invalid`.
 */
export async function verifyAccessToken(token: string, config: AuthConfig): Promise<AccessTokenResult> {
  try {
    const { payload } = await jwtVerify(token, cognitoKeySet(config), {
      issuer: issuerFor(config),
      algorithms: ['RS256'],
      requiredClaims: ['exp', 'iat', 'sub', 'client_id', 'token_use'],
    });
    return isOurAccessToken(payload, config) ? { status: 'valid', claims: payload } : { status: 'invalid' };
  } catch (error) {
    // jose checks signature, iss and claim presence before exp, so JWTExpired implies those passed.
    if (error instanceof errors.JWTExpired && isOurAccessToken(error.payload, config)) return { status: 'expired' };
    return { status: 'invalid' };
  }
}

/**
 * Verifies a Cognito ID token pinned to this pool (`iss`) and app client (`aud`).
 * Input: token, config, and the login nonce when verifying a fresh login.
 * Output: claims. Throws on any failure, including expiry.
 */
export async function verifyIdToken(token: string, config: AuthConfig, nonce?: string): Promise<JWTPayload> {
  const { payload } = await jwtVerify(token, cognitoKeySet(config), {
    issuer: issuerFor(config),
    audience: config.clientId,
    algorithms: ['RS256'],
    requiredClaims: ['exp', 'iat', 'sub', 'token_use'],
  });
  if (payload.token_use !== 'id') throw new Error('Not an ID token');
  if (nonce !== undefined && payload.nonce !== nonce) throw new Error('ID token nonce mismatch');
  return payload;
}
