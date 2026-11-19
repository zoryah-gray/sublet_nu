// @vitest-environment node
// Logged-out users get a 404 for unknown paths but a sign-in redirect for real
// (logged_in) routes, and every (logged_in) route stays in PROTECTED_SEGMENTS.

import { readdirSync } from 'fs';
import path from 'path';
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PROTECTED_SEGMENTS, proxy, requiresSession } from '@/proxy';
import { stubAuthEnv, stubCognitoFetch, tokenCalls } from './helpers';

const LOGGED_IN_DIR = path.join(__dirname, '../../app/(all_pages)/(logged_in)');

/** First URL segments under a directory, looking through (route groups). Input: dir. Output: segment names. */
function urlSegments(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((entry) =>
      entry.name.startsWith('(') ? urlSegments(path.join(dir, entry.name)) : [entry.name],
    );
}

beforeEach(stubAuthEnv);
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('protected route list', () => {
  it('covers every (logged_in) route (a new route must be added to PROTECTED_SEGMENTS)', () => {
    const segments = urlSegments(LOGGED_IN_DIR);
    expect(segments.length).toBeGreaterThan(0);
    for (const segment of segments) expect(PROTECTED_SEGMENTS, segment).toContain(segment);
  });

  it.each(['/browse', '/dashboard', '/listings/1/edit', '/sublet/abc', '/profile/u1', '/api/anything'])(
    'requires a session for %s',
    (pathname) => expect(requiresSession(pathname)).toBe(true),
  );

  it.each(['/', '/login', '/api/auth/login', '/robots.txt', '/does-not-exist', '/browsee', '/foo/bar'])(
    'does not require a session for %s',
    (pathname) => expect(requiresSession(pathname)).toBe(false),
  );
});

describe('logged-out user', () => {
  it('on an unknown path is passed through to the 404 page, not redirected', async () => {
    const calls = stubCognitoFetch();
    const response = await proxy(new NextRequest('http://localhost:3000/does-not-exist'));
    expect(response.headers.get('x-middleware-next')).toBe('1');
    expect(response.headers.get('location')).toBeNull();
    expect(tokenCalls(calls)).toHaveLength(0);
  });

  it('on a real protected route is still redirected to sign-in', async () => {
    const response = await proxy(new NextRequest('http://localhost:3000/favorites'));
    expect(response.headers.get('location')).toBe('http://localhost:3000/login');
  });
});
