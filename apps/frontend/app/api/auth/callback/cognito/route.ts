import { NextResponse, type NextRequest } from 'next/server';
import { exchangeCode } from '@/app/lib/auth/cognito';
import { getAuthConfig } from '@/app/lib/auth/config';
import { cookieNames, cookieOptions, noStore, setSessionCookies, type SessionTokens } from '@/app/lib/auth/cookies';
import { loginErrorFromCognito, type LoginErrorCode } from '@/app/lib/auth/login-errors';
import { decodePkceCookie, safeEqual } from '@/app/lib/auth/pkce';
import { verifyAccessToken, verifyIdToken } from '@/app/lib/auth/tokens';

/**
 * OAuth callback (Cognito's registered callbackUrl). Checks state against the
 * login cookie, exchanges code + PKCE verifier for tokens, verifies them (nonce
 * included), sets the session cookies, then redirects to /browse.
 *
 * Input: GET ?code&state (or ?error from Cognito). Output: redirect to /browse
 * with cookies set, or to /login?error=<code> with no token cookies.
 * The /browse URL is built fresh, so no query or fragment (token material) is ever carried over.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const config = getAuthConfig();
  const names = cookieNames();
  const params = request.nextUrl.searchParams;

  const finish = (url: URL, tokens?: SessionTokens): NextResponse => {
    const response = NextResponse.redirect(url);
    response.cookies.set(names.pkce, '', cookieOptions(0));
    if (tokens) setSessionCookies(response.cookies, tokens);
    return noStore(response);
  };
  const fail = (code: LoginErrorCode): NextResponse => finish(new URL(`/login?error=${code}`, config.appUrl));

  if (params.get('error')) return fail(loginErrorFromCognito(params.get('error_description')));

  const pkce = decodePkceCookie(request.cookies.get(names.pkce)?.value);
  const code = params.get('code');
  const state = params.get('state');
  if (!pkce || !code || !state || !safeEqual(state, pkce.state)) return fail('failed');

  let tokens: SessionTokens;
  try {
    tokens = await exchangeCode(config, code, pkce.verifier);
    const idClaims = await verifyIdToken(tokens.idToken, config, pkce.nonce);
    const access = await verifyAccessToken(tokens.accessToken, config);
    // Both tokens must describe the same user.
    if (access.status !== 'valid' || access.claims.sub !== idClaims.sub) return fail('failed');
  } catch {
    return fail('failed');
  }

  return finish(new URL('/browse', config.appUrl), tokens);
}
