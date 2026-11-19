// Data Access Layer: the secure session check that runs next to the data,
// independent of proxy.ts. Every Server Action and every data read for a signed-in
// user goes through verifySession() / requireSession().

import 'server-only';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { avatarInitials } from '@sublet-nu/shared';
import { getAuthConfig } from '@/app/lib/auth/config';
import { cookieNames } from '@/app/lib/auth/cookies';
import { verifyAccessToken, verifyIdToken } from '@/app/lib/auth/tokens';

export class UnauthorizedError extends Error {
  constructor() {
    super('Not signed in');
  }
}

export interface SessionUser {
  sub: string;
  fullName: string | null;
  email: string;
  avatarInitials: string;
}

/**
 * Verifies the access-token cookie (signature, exp, issuer, client).
 * Output: { sub } or null. Memoized per render pass.
 */
export const verifySession = cache(async (): Promise<{ sub: string } | null> => {
  const token = (await cookies()).get(cookieNames().access)?.value;
  if (!token) return null;
  const result = await verifyAccessToken(token, getAuthConfig());
  return result.status === 'valid' && typeof result.claims.sub === 'string' ? { sub: result.claims.sub } : null;
});

/** Like verifySession, but throws UnauthorizedError when signed out. Use at the top of every Server Action. */
export async function requireSession(): Promise<{ sub: string }> {
  const session = await verifySession();
  if (!session) throw new UnauthorizedError();
  return session;
}

/**
 * Display info for the signed-in user, from the ID-token cookie.
 * Output: SessionUser, or null when signed out or the ID token doesn't verify.
 * The ID token is verified (signature, iss, aud, token_use) and must carry the
 * verified access token's sub, so its email/name can be trusted, not just displayed.
 * Initials fall back to the email's first letter (= display_name's, which derives from it).
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const session = await verifySession();
  if (!session) return null;
  const idToken = (await cookies()).get(cookieNames().id)?.value;
  if (!idToken) return null;
  try {
    const claims = await verifyIdToken(idToken, getAuthConfig());
    if (claims.sub !== session.sub || typeof claims.email !== 'string') return null;
    const fullName = typeof claims.name === 'string' && claims.name.trim() ? claims.name.trim() : null;
    return { sub: session.sub, fullName, email: claims.email, avatarInitials: avatarInitials(fullName, claims.email) };
  } catch {
    return null;
  }
});
