// @vitest-environment node
// Security-audit regressions (added after the finalized list): each test pins a
// hole found while auditing the auth layer, so it can't silently reopen.

import { SignJWT } from 'jose';
import { NextRequest } from 'next/server';
import { unstable_doesMiddlewareMatch } from 'next/experimental/testing/server';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { config as proxyConfig, proxy } from '@/proxy';
import { getAuthConfig } from '@/app/lib/auth/config';
import { verifyAccessToken, verifyIdToken } from '@/app/lib/auth/tokens';
import { ISSUER, TEST_ENV, accessToken, idToken, nowSeconds, setupKeys, stubAuthEnv, stubCognitoFetch, tokenCalls } from './helpers';

beforeAll(setupKeys);
beforeEach(stubAuthEnv);
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('proxy matcher', () => {
  it.each(['/profile/user-jon.png', '/sublet/abc.svg', '/browse/x.jpg', '/listings/1.webp'])(
    'still runs proxy for page URLs ending in an image extension (%s)',
    (url) => {
      expect(unstable_doesMiddlewareMatch({ config: proxyConfig, url })).toBe(true);
    },
  );

  it.each(['/_next/static/chunks/main.js', '/stock_images/room.jpg', '/favicon.ico', '/api/auth/callback/cognito'])(
    'skips static assets and the OAuth callback (%s)',
    (url) => {
      expect(unstable_doesMiddlewareMatch({ config: proxyConfig, url })).toBe(false);
    },
  );
});

describe('token pinning', () => {
  it('rejects a correctly signed token from a different user pool (iss pinned)', async () => {
    stubCognitoFetch();
    const token = await accessToken({ iss: 'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_OtherPool' });
    expect(await verifyAccessToken(token, getAuthConfig())).toEqual({ status: 'invalid' });
  });

  it('rejects an access token for a different app client (client_id pinned)', async () => {
    stubCognitoFetch();
    const token = await accessToken({ client_id: 'some-other-client' });
    expect(await verifyAccessToken(token, getAuthConfig())).toEqual({ status: 'invalid' });
  });

  it('does not refresh an EXPIRED token minted for a different app client', async () => {
    const calls = stubCognitoFetch(() => Response.json({}));
    const token = await accessToken({ client_id: 'some-other-client', iat: nowSeconds() - 7200, exp: nowSeconds() - 3600 });
    const request = new NextRequest('http://localhost:3000/browse', {
      headers: { cookie: `subletnu-access=${token}; subletnu-refresh=r` },
    });
    const response = await proxy(request);
    expect(tokenCalls(calls)).toHaveLength(0);
    expect(response.headers.get('location')).toBe('http://localhost:3000/login');
  });

  it('rejects an ID token used as an access token (token_use pinned)', async () => {
    stubCognitoFetch();
    expect(await verifyAccessToken(await idToken(), getAuthConfig())).toEqual({ status: 'invalid' });
  });

  it('rejects a signed token with no exp claim', async () => {
    stubCognitoFetch();
    const noExp = await accessToken({ exp: undefined });
    expect(await verifyAccessToken(noExp, getAuthConfig())).toEqual({ status: 'invalid' });
  });

  it('rejects an ID token issued for a different app client (aud pinned)', async () => {
    stubCognitoFetch();
    const token = await idToken({ aud: 'some-other-client' });
    await expect(verifyIdToken(token, getAuthConfig())).rejects.toThrow();
  });

  it('rejects a token signed with an unexpected algorithm (alg pinned to RS256)', async () => {
    stubCognitoFetch();
    const hsToken = await new SignJWT({ iss: ISSUER, client_id: TEST_ENV.COGNITO_CLIENT_ID, token_use: 'access', sub: 's' })
      .setProtectedHeader({ alg: 'HS256', kid: 'test-key-1' })
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(new TextEncoder().encode('x'.repeat(32)));
    expect(await verifyAccessToken(hsToken, getAuthConfig())).toEqual({ status: 'invalid' });
  });
});

describe('robots.txt', () => {
  it('is reachable without a session so crawlers can read the disallow rules', async () => {
    const response = await proxy(new NextRequest('http://localhost:3000/robots.txt'));
    expect(response.headers.get('x-middleware-next')).toBe('1');
    expect(response.headers.get('location')).toBeNull();
  });

  it('disallows every path for every crawler', async () => {
    const { default: robots } = await import('@/app/robots');
    expect(robots()).toEqual({ rules: { userAgent: '*', disallow: '/' } });
  });
});

describe('auth responses are never cached', () => {
  it('marks proxy redirects no-store', async () => {
    stubCognitoFetch();
    const response = await proxy(new NextRequest('http://localhost:3000/browse'));
    expect(response.headers.get('cache-control')).toBe('no-store');
  });
});
