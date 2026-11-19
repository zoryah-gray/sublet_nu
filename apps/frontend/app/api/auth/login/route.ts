import { NextResponse } from 'next/server';
import { buildAuthorizeUrl } from '@/app/lib/auth/cognito';
import { getAuthConfig } from '@/app/lib/auth/config';
import { PKCE_MAX_AGE_SECONDS, cookieNames, cookieOptions, noStore } from '@/app/lib/auth/cookies';
import { createPkceSession, encodePkceCookie } from '@/app/lib/auth/pkce';

/**
 * Starts sign-in: stores fresh state/verifier/nonce in a 10-minute cookie and
 * redirects to Cognito's hosted UI, which forwards straight to Google.
 * Input: none. Output: redirect to Cognito /oauth2/authorize.
 */
export async function GET(): Promise<NextResponse> {
  const config = getAuthConfig();
  const { session, codeChallenge } = await createPkceSession();
  const response = NextResponse.redirect(
    buildAuthorizeUrl(config, { codeChallenge, state: session.state, nonce: session.nonce }),
  );
  response.cookies.set(cookieNames().pkce, encodePkceCookie(session), cookieOptions(PKCE_MAX_AGE_SECONDS));
  return noStore(response);
}
