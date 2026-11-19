import AppPreview from '@/app/components/app-preview';
import LoginForm from '@/app/components/login_signup/login-form';
import { loginErrorMessage } from '@/app/lib/auth/login-errors';

/** /login: app preview beside the Google sign-in card. ?error is mapped through a fixed allowlist. */
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;

  return (
    <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-[1fr_24rem] gap-10 items-center">
      <div className="hidden lg:block">
        <AppPreview />
      </div>
      <LoginForm errorMessage={loginErrorMessage(error)} />
    </div>
  );
}
