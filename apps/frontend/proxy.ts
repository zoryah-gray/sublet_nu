import { NextResponse, type NextRequest } from 'next/server';
import { getAuthConfig } from '@/app/lib/auth/config';
import { clearSessionCookies, cookieNames, noStore, setSessionCookies } from '@/app/lib/auth/cookies';
import { resolveSession } from '@/app/lib/auth/session';

// Reachable without a session. /robots.txt must be public or crawlers get
// redirected to /login and never see it.
const PUBLIC_PATHS = new Set(['/', '/login', '/api/auth/login', '/api/auth/logout', '/robots.txt']);

// First path segments that require a session: every (logged_in) route, including
// /browse, plus all of /api (fail closed for API routes). Any other path is passed
// through so Next renders the 404 page instead of bouncing an unknown URL to /login.
// A test (__tests__/auth/protected-routes.test.ts) fails if a (logged_in) route is
// missing from this list.
export const PROTECTED_SEGMENTS = new Set([
  'api', 'browse', 'dashboard', 'favorites', 'listings', 'messages', 'profile', 'requests', 'settings', 'sublet',
]);

/** True if the path needs a session. Input: URL pathname. Output: boolean. */
export function requiresSession(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) return false;
  return PROTECTED_SEGMENTS.has(pathname.split('/')[1]);
}

/**
 * Optimistic session gate, run before every matched request
 *
 * Input: request. 
 * Output: continue (public or unknown paths, or a valid session, optionally with
 * refreshed cookies) or redirect to /login.
 * Not the only check: Server Actions and data reads verify the session themselves (app/lib/dal.ts).
 */
export async function proxy(request: NextRequest): Promise<NextResponse> {
  if (!requiresSession(request.nextUrl.pathname)) return NextResponse.next();

  const names = cookieNames();
  const decision = await resolveSession(
    {
      accessToken: request.cookies.get(names.access)?.value,
      refreshToken: request.cookies.get(names.refresh)?.value,
    },
    getAuthConfig(),
  );

  if (decision.kind === 'proceed') return NextResponse.next();

  if (decision.kind === 'refreshed') {
    // Forward the new tokens on this request too, so Server Components rendering
    // it read the fresh access token instead of the expired one.
    request.cookies.set(names.access, decision.tokens.accessToken);
    request.cookies.set(names.id, decision.tokens.idToken);
    const response = NextResponse.next({ request: { headers: request.headers } });
    setSessionCookies(response.cookies, decision.tokens);
    return noStore(response);
  }

  const response = NextResponse.redirect(new URL('/login', request.url));
  clearSessionCookies(response.cookies);
  return noStore(response);
}

export const config = {
  // Skips only known static locations and the OAuth callback (it creates the
  // session, so it can't require one). Deliberately no "any path ending in
  // .png/.svg" rule: dynamic routes would then skip auth for URLs like
  // /profile/<id>.png. New public assets go under public/stock_images/ or get
  // added here explicitly.
  matcher: [
    '/((?!_next/static/|_next/image$|favicon\\.ico$|stock_images/|api/auth/callback/cognito$).*)',
  ],
};
