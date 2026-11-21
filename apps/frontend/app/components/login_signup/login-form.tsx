import { ExclamationCircleIcon } from '@heroicons/react/24/outline';

/** Google's "G" mark, sized for the sign-in button. */
function GoogleMark() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

/**
 * Sign-in card: one "Continue with Google" action. Google is the only sign-in
 * method, and the first sign-in creates the account, so there's no separate signup.
 * Input: a pre-mapped error message (never raw query text), or null.
 */
export default function LoginForm({ errorMessage }: { errorMessage: string | null }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
      <h1 className="text-2xl font-bold text-gray-900">Welcome to SubletNU</h1>
      <p className="mt-2 text-sm text-gray-500">
        Sign in with your Northwestern Google account. First time here? Signing in creates your account.
      </p>

      {errorMessage && (
        <div role="alert" className="mt-6 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
          <ExclamationCircleIcon className="w-5 h-5 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Plain <a>, not <Link>: the target is a Route Handler that redirects to Cognito, and must not be prefetched. */}
      <a
        href="/api/auth/login"
        className="mt-6 w-full inline-flex items-center justify-center gap-3 rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-gray-800 hover:bg-gray-50 transition-colors"
      >
        <GoogleMark />
        Continue with Google
      </a>

      <p className="mt-4 text-xs text-gray-400 text-center">Only @northwestern.edu accounts (including u. and alum.) can sign in.</p>
    </div>
  );
}
