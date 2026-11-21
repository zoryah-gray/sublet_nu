// Fixed set of login error codes. The callback maps whatever Cognito sent to one
// of these, so /login never renders text from the query string (which anyone can forge).

export const LOGIN_ERROR_MESSAGES = {
  domain: 'Please sign in with your Northwestern Google account.',
  unverified: 'Your Google account email is not verified.',
  setup: "We couldn't finish setting up your account. Please try again in a few minutes.",
  failed: 'Sign-in failed. Please try again.',
} as const;

export type LoginErrorCode = keyof typeof LOGIN_ERROR_MESSAGES;

/**
 * Maps a Cognito error_description (trigger messages arrive as "PreSignUp failed
 * with error ...") to a code. Input: description or null. Output: LoginErrorCode.
 */
export function loginErrorFromCognito(description: string | null): LoginErrorCode {
  const text = description ?? '';
  if (/Northwestern|Gmail account/i.test(text)) return 'domain';
  if (/not verified/i.test(text)) return 'unverified';
  if (/Account setup failed/i.test(text)) return 'setup';
  return 'failed';
}

/** Message for a ?error value. Input: raw query value. Output: message, or null if absent/unknown. */
export function loginErrorMessage(code: string | undefined): string | null {
  return code && Object.hasOwn(LOGIN_ERROR_MESSAGES, code) ? LOGIN_ERROR_MESSAGES[code as LoginErrorCode] : null;
}
