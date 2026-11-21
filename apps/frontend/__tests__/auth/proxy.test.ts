// @vitest-environment node
// Finalized auth tests 1–7: proxy.ts session handling. Test 8 (concurrent refresh
// race) is a documented, accepted gap: see .claude/plans/PLAN.md §7.

import { NextRequest } from 'next/server';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { proxy } from '@/proxy';
import {
  accessToken, idToken, nowSeconds, setCookieLine, setupKeys, stubAuthEnv, stubCognitoFetch, tamperPayload, tokenCalls,
} from './helpers';

const LOGIN_URL = 'http://localhost:3000/login';

/** GET /browse carrying the given session cookies. */
function browseRequest(cookies: Record<string, string> = {}): NextRequest {
  const cookie = Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ');
  return new NextRequest('http://localhost:3000/browse', { headers: cookie ? { cookie } : {} });
}

/** A successful refresh_token response from Cognito (no new refresh token). */
async function refreshSuccess(): Promise<Response> {
  return Response.json({ access_token: await accessToken(), id_token: await idToken(), token_type: 'Bearer', expires_in: 3600 });
}

/** Asserts a redirect to /login that expires every session cookie. */
function expectSignedOutRedirect(response: Response): void {
  expect(response.headers.get('location')).toBe(LOGIN_URL);
  for (const name of ['subletnu-access', 'subletnu-id', 'subletnu-refresh']) {
    expect(setCookieLine(response.headers, name)).toMatch(/Max-Age=0/);
  }
}

beforeAll(setupKeys);
beforeEach(stubAuthEnv);
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('proxy.ts session handling', () => {
  it('1. no session cookie on a protected route redirects to sign-in', async () => {
    const calls = stubCognitoFetch();
    const response = await proxy(browseRequest());
    expect(response.headers.get('location')).toBe(LOGIN_URL);
    expect(tokenCalls(calls)).toHaveLength(0);
  });

  it('2. valid, unexpired access token proceeds with no refresh and no cookie writes', async () => {
    const calls = stubCognitoFetch();
    const response = await proxy(browseRequest({ 'subletnu-access': await accessToken(), 'subletnu-refresh': 'refresh-1' }));
    expect(response.headers.get('x-middleware-next')).toBe('1');
    expect(response.headers.get('location')).toBeNull();
    expect(tokenCalls(calls)).toHaveLength(0);
    expect(response.headers.getSetCookie()).toEqual([]);
  });

  it('3. expired access token + valid refresh token refreshes silently and proceeds', async () => {
    const calls = stubCognitoFetch(refreshSuccess);
    const expired = await accessToken({ iat: nowSeconds() - 7200, exp: nowSeconds() - 3600 });
    const response = await proxy(browseRequest({ 'subletnu-access': expired, 'subletnu-refresh': 'refresh-1' }));

    const [call] = tokenCalls(calls);
    expect(call.init?.cache).toBe('no-store');
    const body = new URLSearchParams(String(call.init?.body));
    expect(body.get('grant_type')).toBe('refresh_token');
    expect(body.get('refresh_token')).toBe('refresh-1');

    expect(response.headers.get('location')).toBeNull();
    expect(response.headers.get('x-middleware-next')).toBe('1');
    const newAccess = setCookieLine(response.headers, 'subletnu-access');
    expect(newAccess).toBeDefined();
    expect(newAccess).not.toContain(expired);
    expect(setCookieLine(response.headers, 'subletnu-id')).toBeDefined();
    // The original request is forwarded with the fresh token, not the expired one.
    expect(response.headers.get('x-middleware-request-cookie')).not.toContain(expired);
  });

  it('4. expired access token + expired/revoked refresh token clears the session and redirects', async () => {
    const calls = stubCognitoFetch(() => Response.json({ error: 'invalid_grant' }, { status: 400 }));
    const expired = await accessToken({ iat: nowSeconds() - 7200, exp: nowSeconds() - 3600 });
    const response = await proxy(browseRequest({ 'subletnu-access': expired, 'subletnu-refresh': 'revoked' }));
    expect(tokenCalls(calls)).toHaveLength(1);
    expectSignedOutRedirect(response);
  });

  it.each([
    ['payload edited after signing', async () => tamperPayload(await accessToken({ exp: nowSeconds() - 60 }), { sub: 'someone-else' })],
    ['signed by a different key', async () => accessToken({ exp: nowSeconds() - 60 }, { attacker: true })],
  ])('5. signature failure (%s) clears the session and redirects without refreshing', async (_label, makeToken) => {
    const calls = stubCognitoFetch(refreshSuccess);
    const response = await proxy(browseRequest({ 'subletnu-access': await makeToken(), 'subletnu-refresh': 'refresh-1' }));
    expect(tokenCalls(calls)).toHaveLength(0);
    expectSignedOutRedirect(response);
  });

  it.each(['not-a-jwt', 'a.b.c', '%%%', 'eyJhbGciOiJSUzI1NiJ9'])(
    '6. malformed cookie value %j is treated as unauthenticated without throwing',
    async (value) => {
      const calls = stubCognitoFetch(refreshSuccess);
      const response = await proxy(browseRequest({ 'subletnu-access': value, 'subletnu-refresh': 'refresh-1' }));
      expect(tokenCalls(calls)).toHaveLength(0);
      expectSignedOutRedirect(response);
    },
  );

  it('7. exp exactly equal to now is treated as expired', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-01T12:00:00Z'));
    const calls = stubCognitoFetch(refreshSuccess);
    const atExpiry = await accessToken({ iat: nowSeconds() - 3600, exp: nowSeconds() });
    const response = await proxy(browseRequest({ 'subletnu-access': atExpiry, 'subletnu-refresh': 'refresh-1' }));
    // Expired → the refresh path ran; a still-valid token would have made no token call.
    expect(tokenCalls(calls)).toHaveLength(1);
    expect(response.headers.get('x-middleware-next')).toBe('1');
  });
});
