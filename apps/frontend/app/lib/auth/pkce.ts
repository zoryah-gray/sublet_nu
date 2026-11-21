// One-time login values, created by /api/auth/login and checked by the callback.
// PKCE: Cognito only releases tokens to whoever holds the verifier behind the
// challenge it saw. state: the callback must belong to a login this browser started
// (login CSRF). nonce: the ID token must have been minted for this login (replay).

import { timingSafeEqual } from 'node:crypto';

export interface PkceSession {
  state: string;
  verifier: string;
  nonce: string;
}

/** base64url encoding without padding. Input: bytes. Output: string. */
function base64Url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64url');
}

/** Random base64url string. Input: byte count. Output: string. */
function randomToken(bytes = 32): string {
  return base64Url(crypto.getRandomValues(new Uint8Array(bytes)));
}

/** Creates state, verifier and nonce, plus the S256 challenge. Output: session and challenge. */
export async function createPkceSession(): Promise<{ session: PkceSession; codeChallenge: string }> {
  const session = { state: randomToken(), verifier: randomToken(), nonce: randomToken() };
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(session.verifier));
  return { session, codeChallenge: base64Url(new Uint8Array(digest)) };
}

/** Serializes the session for its cookie. Input: session. Output: cookie value. */
export function encodePkceCookie(session: PkceSession): string {
  return Buffer.from(JSON.stringify(session)).toString('base64url');
}

/** Parses the cookie value. Input: raw value. Output: session, or null if missing or malformed. */
export function decodePkceCookie(value: string | undefined): PkceSession | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
    const valid = ['state', 'verifier', 'nonce'].every((key) => typeof parsed?.[key] === 'string' && parsed[key]);
    return valid ? (parsed as PkceSession) : null;
  } catch {
    return null;
  }
}

/** Constant-time string comparison. Input: two strings. Output: true if equal. */
export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
