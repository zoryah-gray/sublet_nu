'use client';

import { useState } from 'react';
import Link from 'next/link';
import { EyeIcon, EyeSlashIcon, CheckIcon } from '@heroicons/react/24/outline';
import { Switch } from '@/components/ui/switch';

// ─── Password helpers ──────────────────────────────────────────────────────────

const SPECIAL_CHARS = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?]/;

function passwordScore(pw: string): number {
  let score = 0;
  if (pw.length >= 8)          score++;
  if (pw.length >= 12)         score++;
  if (SPECIAL_CHARS.test(pw))  score++;
  if (/\d/.test(pw))           score++;
  return score;
}

const STRENGTH_LABELS: Record<number, string> = { 0: 'Weak', 1: 'Weak', 2: 'Fair', 3: 'Good', 4: 'Strong' };
const STRENGTH_COLORS: Record<number, string> = {
  0: 'bg-red-400',
  1: 'bg-red-400',
  2: 'bg-yellow-400',
  3: 'bg-blue-400',
  4: 'bg-green-500',
};
const STRENGTH_TEXT_COLORS: Record<number, string> = {
  0: 'text-red-500',
  1: 'text-red-500',
  2: 'text-yellow-600',
  3: 'text-blue-600',
  4: 'text-green-600',
};

// ─── Google icon ───────────────────────────────────────────────────────────────

function GoogleIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

// ─── Password strength UI ──────────────────────────────────────────────────────

function PasswordStrengthPanel({ password }: { password: string }) {
  if (!password) return null;

  const score = passwordScore(password);
  const hasMinLength = password.length >= 8;
  const hasSpecial = SPECIAL_CHARS.test(password);
  const hasNumber = /\d/.test(password);

  return (
    <div className="mt-2 rounded-lg bg-gray-50 border border-gray-200 p-3 space-y-2">
      {/* Checklist */}
      <p className="text-xs font-medium text-gray-600">Your Password must include</p>
      <ul className="space-y-1" aria-live="polite">
        <li className="flex items-start gap-2 text-xs">
          <span
            className={`flex items-center justify-center w-4 h-4 rounded-full shrink-0 mt-0.5 ${hasMinLength ? 'bg-green-500' : 'bg-gray-200'}`}
            aria-hidden="true"
          >
            <CheckIcon className="w-2.5 h-2.5 text-white" strokeWidth={3} />
          </span>
          <span className={hasMinLength ? 'text-gray-700' : 'text-gray-400'}>At least 8 characters</span>
        </li>
        <li className="flex items-start gap-2 text-xs">
          <span
            className={`flex items-center justify-center w-4 h-4 rounded-full shrink-0 mt-0.5 ${hasSpecial ? 'bg-green-500' : 'bg-gray-200'}`}
            aria-hidden="true"
          >
            <CheckIcon className="w-2.5 h-2.5 text-white" strokeWidth={3} />
          </span>
          <span className={hasSpecial ? 'text-gray-700' : 'text-gray-400'}>
            At least one special character{' '}
            <span className="text-gray-400">(!@#$%^&*)</span>
          </span>
        </li>
        <li className="flex items-start gap-2 text-xs">
          <span
            className={`flex items-center justify-center w-4 h-4 rounded-full shrink-0 mt-0.5 ${hasNumber ? 'bg-green-500' : 'bg-gray-200'}`}
            aria-hidden="true"
          >
            <CheckIcon className="w-2.5 h-2.5 text-white" strokeWidth={3} />
          </span>
          <span className={hasNumber ? 'text-gray-700' : 'text-gray-400'}>At least one number</span>
        </li>
      </ul>

      {/* Strength bar */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-gray-600">Password Strength</span>
          <span className={`text-xs font-semibold ${STRENGTH_TEXT_COLORS[score]}`}>
            {STRENGTH_LABELS[score]}
          </span>
        </div>
        <div className="flex gap-1" role="img" aria-label={`Password strength: ${STRENGTH_LABELS[score]}`}>
          {[1, 2, 3, 4].map((seg) => (
            <div
              key={seg}
              className={`h-1.5 flex-1 rounded-full transition-colors duration-200 ${
                seg <= score ? STRENGTH_COLORS[score] : 'bg-gray-200'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Step 1 ────────────────────────────────────────────────────────────────────

interface Step1Fields {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

interface Step1Errors {
  firstName?: string;
  lastName?: string;
  email?: string;
  password?: string;
}

function Step1({
  fields,
  onChange,
  onContinue,
}: {
  fields: Step1Fields;
  onChange: (f: Partial<Step1Fields>) => void;
  onContinue: () => void;
}) {
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Step1Errors>({});

  function validate(): Step1Errors {
    const e: Step1Errors = {};
    if (!fields.firstName.trim()) e.firstName = 'First name is required.';
    if (!fields.lastName.trim())  e.lastName  = 'Last name is required.';
    if (!fields.email.trim() || !fields.email.includes('@')) e.email = 'Enter a valid email address.';
    if (!fields.password)         e.password  = 'Password is required.';
    else if (fields.password.length < 8) e.password = 'Password must be at least 8 characters.';
    return e;
  }

  function handleContinue(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length === 0) onContinue();
  }

  return (
    <div className="rounded-xl bg-white shadow-lg border border-gray-100 px-6 pb-6 pt-8">
      <h1 className="text-2xl font-bold text-gray-900">Create your account</h1>
      <p className="mt-1 text-sm text-gray-500">
        Already have an account?{' '}
        <Link href="/login" className="text-violet-700 hover:underline font-medium">
          Log in
        </Link>
      </p>

      <form onSubmit={handleContinue} noValidate className="mt-6 space-y-4">
        {/* Name row */}
        <div className="flex gap-3">
          <div className="flex-1">
            <label htmlFor="signup-first-name" className="block text-sm font-medium text-gray-700 mb-1">
              First name
            </label>
            <input
              id="signup-first-name"
              type="text"
              autoComplete="given-name"
              value={fields.firstName}
              onChange={(e) => onChange({ firstName: e.target.value })}
              placeholder="First name"
              aria-describedby={errors.firstName ? 'signup-fn-error' : undefined}
              aria-invalid={!!errors.firstName}
              className={`w-full rounded-lg border px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-600 focus-visible:border-violet-400 transition-colors ${
                errors.firstName ? 'border-red-400 bg-red-50' : 'border-gray-300 bg-white'
              }`}
            />
            {errors.firstName && (
              <p id="signup-fn-error" role="alert" className="mt-1 text-xs text-red-600">
                {errors.firstName}
              </p>
            )}
          </div>
          <div className="flex-1">
            <label htmlFor="signup-last-name" className="block text-sm font-medium text-gray-700 mb-1">
              Last name
            </label>
            <input
              id="signup-last-name"
              type="text"
              autoComplete="family-name"
              value={fields.lastName}
              onChange={(e) => onChange({ lastName: e.target.value })}
              placeholder="Last name"
              aria-describedby={errors.lastName ? 'signup-ln-error' : undefined}
              aria-invalid={!!errors.lastName}
              className={`w-full rounded-lg border px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-600 focus-visible:border-violet-400 transition-colors ${
                errors.lastName ? 'border-red-400 bg-red-50' : 'border-gray-300 bg-white'
              }`}
            />
            {errors.lastName && (
              <p id="signup-ln-error" role="alert" className="mt-1 text-xs text-red-600">
                {errors.lastName}
              </p>
            )}
          </div>
        </div>

        {/* Email */}
        <div>
          <label htmlFor="signup-email" className="block text-sm font-medium text-gray-700 mb-1">
            Email
          </label>
          <input
            id="signup-email"
            type="email"
            autoComplete="email"
            value={fields.email}
            onChange={(e) => onChange({ email: e.target.value })}
            placeholder="Enter your email"
            aria-describedby={errors.email ? 'signup-email-error' : undefined}
            aria-invalid={!!errors.email}
            className={`w-full rounded-lg border px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-600 focus-visible:border-violet-400 transition-colors ${
              errors.email ? 'border-red-400 bg-red-50' : 'border-gray-300 bg-white'
            }`}
          />
          {errors.email && (
            <p id="signup-email-error" role="alert" className="mt-1 text-xs text-red-600">
              {errors.email}
            </p>
          )}
        </div>

        {/* Password */}
        <div>
          <label htmlFor="signup-password" className="block text-sm font-medium text-gray-700 mb-1">
            Password
          </label>
          <div className="relative">
            <input
              id="signup-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              value={fields.password}
              onChange={(e) => onChange({ password: e.target.value })}
              placeholder="Create a password"
              aria-describedby={errors.password ? 'signup-pw-error' : 'signup-pw-hint'}
              aria-invalid={!!errors.password}
              className={`w-full rounded-lg border px-3 py-2 pr-10 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-600 focus-visible:border-violet-400 transition-colors ${
                errors.password ? 'border-red-400 bg-red-50' : 'border-gray-300 bg-white'
              }`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus-visible:ring-2 focus-visible:ring-violet-600 rounded"
            >
              {showPassword ? <EyeSlashIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
            </button>
          </div>
          {errors.password && (
            <p id="signup-pw-error" role="alert" className="mt-1 text-xs text-red-600">
              {errors.password}
            </p>
          )}
          <div id="signup-pw-hint">
            <PasswordStrengthPanel password={fields.password} />
          </div>
        </div>

        <button
          type="submit"
          className="w-full rounded-lg bg-violet-800 py-2.5 text-sm font-semibold text-white hover:bg-violet-900 focus-visible:ring-2 focus-visible:ring-violet-600 focus-visible:ring-offset-2 transition-colors"
        >
          Continue
        </button>
      </form>

      {/* Divider */}
      <div className="relative my-5">
        <div className="absolute inset-0 flex items-center" aria-hidden="true">
          <div className="w-full border-t border-gray-200" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-white px-3 text-gray-400">or</span>
        </div>
      </div>

      <button
        type="button"
        className="w-full flex items-center justify-center gap-2.5 rounded-lg border border-gray-300 bg-white py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-violet-600 focus-visible:ring-offset-2 transition-colors"
      >
        <GoogleIcon />
        Continue with Google
      </button>
    </div>
  );
}

// ─── Step 2 ────────────────────────────────────────────────────────────────────

function Step2({
  onBack,
  onSubmit,
}: {
  onBack: () => void;
  onSubmit: () => void;
}) {
  const [publicProfile, setPublicProfile]     = useState(false);
  const [emailNotifs, setEmailNotifs]         = useState(false);
  const [agreedToTerms, setAgreedToTerms]     = useState(false);
  const [termsError, setTermsError]           = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!agreedToTerms) {
      setTermsError(true);
      return;
    }
    onSubmit();
  }

  return (
    <div className="rounded-xl bg-white shadow-lg border border-gray-100 px-6 pb-6 pt-8">
      <button
        type="button"
        onClick={onBack}
        className="mb-4 text-sm text-violet-700 hover:underline focus-visible:ring-2 focus-visible:ring-violet-600 rounded"
      >
        ← Back
      </button>

      <h1 className="text-2xl font-bold text-gray-900">Almost there!</h1>
      <p className="mt-1 text-sm text-gray-500">Set your preferences to finish creating your account.</p>

      <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-5">
        {/* Public profile */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-gray-800">Public profile</p>
            <p className="text-xs text-gray-500 mt-0.5">
              Profiles are private by default. Enable to let others find you.
            </p>
          </div>
          <Switch
            id="signup-public-profile"
            checked={publicProfile}
            onCheckedChange={setPublicProfile}
            aria-label="Public profile"
          />
        </div>

        {/* Email notifications */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-gray-800">Email notifications</p>
            <p className="text-xs text-gray-500 mt-0.5">
              Get notified about match requests and updates.
            </p>
          </div>
          <Switch
            id="signup-email-notifs"
            checked={emailNotifs}
            onCheckedChange={setEmailNotifs}
            aria-label="Email notifications"
          />
        </div>

        <div className="border-t border-gray-100 pt-4">
          {/* Terms checkbox */}
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={agreedToTerms}
              onChange={(e) => {
                setAgreedToTerms(e.target.checked);
                if (e.target.checked) setTermsError(false);
              }}
              aria-describedby={termsError ? 'signup-terms-error' : undefined}
              aria-invalid={termsError}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-violet-700 focus-visible:ring-2 focus-visible:ring-violet-600 accent-violet-700"
            />
            <span className="text-sm text-gray-600">
              By signing up, I agree to the{' '}
              <Link href="/terms" className="text-violet-700 underline hover:text-violet-900">
                terms and conditions
              </Link>
              .
            </span>
          </label>
          {termsError && (
            <p id="signup-terms-error" role="alert" className="mt-1 text-xs text-red-600 pl-7">
              You must agree to the terms and conditions.
            </p>
          )}
        </div>

        <button
          type="submit"
          className="w-full rounded-lg bg-violet-800 py-2.5 text-sm font-semibold text-white hover:bg-violet-900 focus-visible:ring-2 focus-visible:ring-violet-600 focus-visible:ring-offset-2 transition-colors"
        >
          Create Account
        </button>
      </form>
    </div>
  );
}

// ─── Root component ────────────────────────────────────────────────────────────

/** Two-step signup form. Step 1 collects account details; Step 2 sets preferences. */
export default function SignupForm() {
  const [step, setStep] = useState<1 | 2>(1);
  const [done, setDone] = useState(false);
  const [fields, setFields] = useState<Step1Fields>({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
  });

  if (done) {
    return (
      <div className="rounded-xl bg-white shadow-lg border border-gray-100 px-6 py-8 text-center">
        <p className="text-lg font-semibold text-gray-800">Account created!</p>
        <p className="text-sm text-gray-500 mt-1">Auth is not wired up yet — this is a UI prototype.</p>
        <Link href="/login" className="mt-4 inline-block text-sm text-violet-700 hover:underline font-medium">
          Go to login →
        </Link>
      </div>
    );
  }

  return step === 1 ? (
    <Step1
      fields={fields}
      onChange={(f) => setFields((prev) => ({ ...prev, ...f }))}
      onContinue={() => setStep(2)}
    />
  ) : (
    <Step2
      onBack={() => setStep(1)}
      onSubmit={() => setDone(true)}
    />
  );
}
