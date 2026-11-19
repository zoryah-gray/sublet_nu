import type { NextResponse } from 'next/server';

type ResponseCookies = NextResponse['cookies'];

/** Matches the Cognito client's refreshTokenValidity (auth-stack.ts). */
export const SESSION_MAX_AGE_SECONDS = 5 * 24 * 60 * 60; // 5 days
export const PKCE_MAX_AGE_SECONDS = 10 * 60;

export interface SessionTokens {
  accessToken: string;
  idToken: string;
  /** Cognito returns a refresh token on the code exchange only, not on refresh. */
  refreshToken?: string;
}

const isProduction = (): boolean => process.env.NODE_ENV === 'production';

/**
 * Cookie names. The __Host- prefix (prod only, because it requires Secure) makes
 * the browser refuse any version set by a subdomain or without Path=/.
 */
export function cookieNames() {
  const prefix = isProduction() ? '__Host-' : '';
  return {
    access: `${prefix}subletnu-access`,
    id: `${prefix}subletnu-id`,
    refresh: `${prefix}subletnu-refresh`,
    pkce: `${prefix}subletnu-pkce`,
  };
}

/**
 * Options for every auth cookie. 
 * Input: max-age in seconds. 
 * Output: cookie options.
 *
 * HttpOnly: page JavaScript can't read the tokens. 
 * Secure (prod): HTTPS only.
 * SameSite=Lax, not Strict: Strict cookies aren't sent on the redirect chain that
 * starts at Cognito, so the first /browse load after login would look signed out.
 * Token cookies outlive the 1 h access token (max-age = session length) so an
 * expired token still reaches proxy.ts and can be refreshed.
 */
export function cookieOptions(maxAge: number = SESSION_MAX_AGE_SECONDS) {
  return { httpOnly: true, secure: isProduction(), sameSite: 'lax' as const, path: '/', maxAge };
}

/** Writes the session token cookies. Input: response cookie jar, tokens. */
export function setSessionCookies(jar: ResponseCookies, tokens: SessionTokens): void {
  const names = cookieNames();
  jar.set(names.access, tokens.accessToken, cookieOptions());
  jar.set(names.id, tokens.idToken, cookieOptions());
  if (tokens.refreshToken) jar.set(names.refresh, tokens.refreshToken, cookieOptions());
}

/** Marks a response uncacheable: anything that sets or clears session cookies must never be stored by a CDN or browser cache. */
export function noStore<T extends NextResponse>(response: T): T {
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

/** Expires every session cookie (same attributes, so __Host- deletions are accepted). */
export function clearSessionCookies(jar: ResponseCookies): void {
  const names = cookieNames();
  for (const name of [names.access, names.id, names.refresh]) jar.set(name, '', cookieOptions(0));
}
