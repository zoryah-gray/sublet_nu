import { NextResponse, type NextRequest } from 'next/server';
import { buildLogoutUrl, revokeRefreshToken } from '@/app/lib/auth/cognito';
import { getAuthConfig } from '@/app/lib/auth/config';
import { clearSessionCookies, cookieNames, noStore } from '@/app/lib/auth/cookies';

/**
 * Signs out: revokes the refresh token (best effort), clears the session cookies,
 * then sends the browser to Cognito's hosted-UI /logout so the Cognito session
 * ends too (otherwise the next login silently reuses it).
 *
 * Input: POST (form submit). Output: 303 redirect to Cognito /logout, which returns to /.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const config = getAuthConfig();
  // Forced-logout CSRF: refuse cross-site form posts.
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(config.appUrl).origin) return new NextResponse(null, { status: 403 });

  const refreshToken = request.cookies.get(cookieNames().refresh)?.value;
  if (refreshToken) await revokeRefreshToken(config, refreshToken);

  const response = NextResponse.redirect(buildLogoutUrl(config), 303);
  clearSessionCookies(response.cookies);
  return noStore(response);
}
