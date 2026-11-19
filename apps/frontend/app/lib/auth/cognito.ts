// Calls to Cognito's OAuth endpoints. Every fetch is cache: 'no-store': token
// responses must never be served from, or written to, Next's data cache.

import { callbackUrlFor, type AuthConfig } from './config';
import type { SessionTokens } from './cookies';

export class CognitoTokenError extends Error {
  constructor(readonly status: number) {
    // Status only: the response body can contain token material.
    super(`Cognito token endpoint returned ${status}`);
  }
}

interface TokenResponse {
  access_token: string;
  id_token: string;
  refresh_token?: string;
}

/** POSTs a form to /oauth2/token. 
 * Input: config, form fields. 
 * Output: tokens. Throws CognitoTokenError. 
 * */
async function postToken(config: AuthConfig, fields: Record<string, string>): Promise<SessionTokens> {
  const response = await fetch(`${config.cognitoDomain}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: config.clientId, ...fields }),
    cache: 'no-store',
  });
  if (!response.ok) throw new CognitoTokenError(response.status);
  const body = (await response.json()) as TokenResponse;
  return { accessToken: body.access_token, idToken: body.id_token, refreshToken: body.refresh_token };
}

/**
 * Hosted-UI authorize URL that skips Cognito's chooser and goes straight to Google.
 * Input: config, PKCE challenge, state, nonce. Output: URL to redirect the browser to.
 */
export function buildAuthorizeUrl(
  config: AuthConfig,
  { codeChallenge, state, nonce }: { codeChallenge: string; state: string; nonce: string },
): URL {
  const url = new URL(`${config.cognitoDomain}/oauth2/authorize`);
  url.search = new URLSearchParams({
    response_type: 'code',
    client_id: config.clientId,
    redirect_uri: callbackUrlFor(config),
    identity_provider: 'Google',
    scope: 'openid email profile',
    state,
    nonce,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  }).toString();
  return url;
}

/** Exchanges an authorization code (+ PKCE verifier) for tokens. Input: config, code, verifier. Output: tokens. */
export function exchangeCode(config: AuthConfig, code: string, codeVerifier: string): Promise<SessionTokens> {
  return postToken(config, {
    grant_type: 'authorization_code',
    code,
    redirect_uri: callbackUrlFor(config),
    code_verifier: codeVerifier,
  });
}

/** Gets new access + ID tokens with a refresh token. Input: config, refresh token. Output: tokens (no refresh token). */
export function refreshTokens(config: AuthConfig, refreshToken: string): Promise<SessionTokens> {
  return postToken(config, { grant_type: 'refresh_token', refresh_token: refreshToken });
}

/** Revokes a refresh token so a copied cookie can't mint new tokens. Best effort: never throws. */
export async function revokeRefreshToken(config: AuthConfig, refreshToken: string): Promise<void> {
  try {
    await fetch(`${config.cognitoDomain}/oauth2/revoke`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: config.clientId, token: refreshToken }),
      cache: 'no-store',
    });
  } catch {
    // Logout still clears cookies and ends the hosted-UI session.
  }
}

/** Hosted-UI logout URL; logout_uri must match the client's logoutUrls exactly. */
export function buildLogoutUrl(config: AuthConfig): URL {
  const url = new URL(`${config.cognitoDomain}/logout`);
  url.search = new URLSearchParams({ client_id: config.clientId, logout_uri: `${config.appUrl}/` }).toString();
  return url;
}
