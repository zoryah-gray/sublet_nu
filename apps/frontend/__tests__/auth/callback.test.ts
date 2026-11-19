// @vitest-environment node
// Auth tests 11–12 (finalized) and 13–15 (login CSRF / PKCE / nonce): the OAuth callback Route Handler.

import { NextRequest } from 'next/server';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from '@/app/api/auth/callback/cognito/route';
import { encodePkceCookie } from '@/app/lib/auth/pkce';
import { accessToken, idToken, setCookieLine, setupKeys, stubAuthEnv, stubCognitoFetch, tokenCalls } from './helpers';

const PKCE = { state: 'state-abc', verifier: 'verifier-xyz', nonce: 'nonce-123' };
const REFRESH_TOKEN = 'refresh-token-opaque-value';

/** Callback request. Input: query string, cookie prefix, whether to send the PKCE cookie. */
function callbackRequest(query: string, { prefix = '', withPkce = true } = {}): NextRequest {
  const headers: Record<string, string> = withPkce ? { cookie: `${prefix}subletnu-pkce=${encodePkceCookie(PKCE)}` } : {};
  return new NextRequest(`http://localhost:3000/api/auth/callback/cognito?${query}`, { headers });
}

/** Stubs a successful code exchange. Input: ID-token nonce. Output: issued tokens and recorded calls. */
async function stubExchange(nonce = PKCE.nonce) {
  const tokens = { access: await accessToken(), id: await idToken({ nonce }) };
  const calls = stubCognitoFetch(() =>
    Response.json({ access_token: tokens.access, id_token: tokens.id, refresh_token: REFRESH_TOKEN, expires_in: 3600 }),
  );
  return { tokens, calls };
}

const TOKEN_COOKIES = ['subletnu-access', 'subletnu-id', 'subletnu-refresh'];

/** Asserts a failed login: /login?error=failed and no token cookie set (only cleared PKCE). */
function expectFailedWithoutTokens(response: Response): void {
  expect(response.headers.get('location')).toBe('http://localhost:3000/login?error=failed');
  for (const name of TOKEN_COOKIES) expect(setCookieLine(response.headers, name)).toBeUndefined();
}

beforeAll(setupKeys);
beforeEach(stubAuthEnv);
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('OAuth callback Route Handler', () => {
  it.each([
    ['production', '__Host-', true],
    ['development', '', false],
  ])('11. Set-Cookie headers (%s): HttpOnly on every token cookie, Secure only in prod, SameSite=Lax', async (env, prefix, secure) => {
    vi.stubEnv('NODE_ENV', env);
    await stubExchange();
    const response = await GET(callbackRequest(`code=code-1&state=${PKCE.state}`, { prefix }));
    for (const name of TOKEN_COOKIES) {
      const line = setCookieLine(response.headers, `${prefix}${name}`);
      expect(line, name).toBeDefined();
      expect(line).toMatch(/;\s*HttpOnly/i);
      expect(line).toMatch(/;\s*SameSite=Lax/i);
      expect(/;\s*Secure/i.test(line!)).toBe(secure);
    }
  });

  it('12. final redirect is exactly /browse with no token material in query or fragment', async () => {
    const { tokens } = await stubExchange();
    const response = await GET(
      callbackRequest(`code=code-1&state=${PKCE.state}&access_token=leak&id_token=leak&extra=1#frag`),
    );
    const location = response.headers.get('location')!;
    expect(location).toBe('http://localhost:3000/browse');
    expect(location).not.toMatch(/[?#]/);
    for (const secret of [tokens.access, tokens.id, REFRESH_TOKEN, 'code-1', 'leak']) expect(location).not.toContain(secret);
  });

  it('13. state mismatch is rejected before any token exchange', async () => {
    const { calls } = await stubExchange();
    const response = await GET(callbackRequest('code=code-1&state=forged-state'));
    expect(tokenCalls(calls)).toHaveLength(0);
    expectFailedWithoutTokens(response);
  });

  it('14. missing PKCE cookie is rejected before any token exchange', async () => {
    const { calls } = await stubExchange();
    const response = await GET(callbackRequest(`code=code-1&state=${PKCE.state}`, { withPkce: false }));
    expect(tokenCalls(calls)).toHaveLength(0);
    expectFailedWithoutTokens(response);
  });

  it('15. ID-token nonce mismatch sets no session', async () => {
    const { calls } = await stubExchange('nonce-from-another-login');
    const response = await GET(callbackRequest(`code=code-1&state=${PKCE.state}`));
    expect(tokenCalls(calls)).toHaveLength(1);
    expectFailedWithoutTokens(response);
  });
});
