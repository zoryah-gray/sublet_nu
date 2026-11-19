// @vitest-environment node
// Finalized auth test 9: logout clears cookies locally AND ends the Cognito hosted-UI session.

import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from '@/app/api/auth/logout/route';
import { TEST_ENV, setCookieLine, stubAuthEnv, stubCognitoFetch } from './helpers';

beforeEach(stubAuthEnv);
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('logout Route Handler', () => {
  it('9. clears session cookies and redirects to Cognito hosted-UI /logout', async () => {
    const calls = stubCognitoFetch();
    const request = new NextRequest('http://localhost:3000/api/auth/logout', {
      method: 'POST',
      headers: { cookie: 'subletnu-access=a; subletnu-id=i; subletnu-refresh=r', origin: 'http://localhost:3000' },
    });
    const response = await POST(request);

    expect(response.status).toBe(303);
    const location = new URL(response.headers.get('location')!);
    expect(`${location.origin}${location.pathname}`).toBe(`${TEST_ENV.COGNITO_DOMAIN}/logout`);
    expect(location.searchParams.get('client_id')).toBe(TEST_ENV.COGNITO_CLIENT_ID);
    expect(location.searchParams.get('logout_uri')).toBe('http://localhost:3000/');

    for (const name of ['subletnu-access', 'subletnu-id', 'subletnu-refresh']) {
      expect(setCookieLine(response.headers, name)).toMatch(/Max-Age=0/);
    }
    expect(calls.some((c) => c.url === `${TEST_ENV.COGNITO_DOMAIN}/oauth2/revoke`)).toBe(true);
  });
});
