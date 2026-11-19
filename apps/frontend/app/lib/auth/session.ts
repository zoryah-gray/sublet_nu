// Decides what proxy.ts does with a request's session cookies. Pure (no Next
// imports), so every branch is easy to reason about and test.

import { refreshTokens } from './cognito';
import type { AuthConfig } from './config';
import type { SessionTokens } from './cookies';
import { verifyAccessToken } from './tokens';

export type SessionDecision =
  | { kind: 'proceed' }
  | { kind: 'refreshed'; tokens: SessionTokens }
  | { kind: 'unauthenticated' };

/**
 * Resolves a request's session.
 *
 * Input: access/refresh cookie values, config. Output: proceed, refreshed (new
 * tokens), or unauthenticated.
 * - no access token → unauthenticated
 * - valid → proceed (no refresh, no cookie writes)
 * - expired → refresh once; failure, or a refreshed token that doesn't verify → unauthenticated
 * - invalid (bad signature, malformed, wrong claims) → unauthenticated, with NO
 *   refresh: a trust failure means nothing in this cookie set can be trusted
 */
export async function resolveSession(
  cookies: { accessToken?: string; refreshToken?: string },
  config: AuthConfig,
): Promise<SessionDecision> {
  if (!cookies.accessToken) return { kind: 'unauthenticated' };

  const result = await verifyAccessToken(cookies.accessToken, config);
  if (result.status === 'valid') return { kind: 'proceed' };
  if (result.status === 'invalid' || !cookies.refreshToken) return { kind: 'unauthenticated' };

  try {
    const tokens = await refreshTokens(config, cookies.refreshToken);
    const refreshed = await verifyAccessToken(tokens.accessToken, config);
    return refreshed.status === 'valid' ? { kind: 'refreshed', tokens } : { kind: 'unauthenticated' };
  } catch {
    return { kind: 'unauthenticated' };
  }
}
