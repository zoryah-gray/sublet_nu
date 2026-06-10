'use client';

import { useState } from 'react';
import { LockClosedIcon, CheckBadgeIcon } from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Spinner } from '@/components/ui/spinner';
import { Separator } from '@/components/ui/separator';
import ConfirmDialog from '@/app/components/confirm-dialog';
import NotificationBanner from '@/app/components/notification-banner';
import EditProfileForm from '@/app/components/ui/edit-profile-form';
import VisibilityToggle from '@/app/components/ui/visibility-toggle';
import { MOCK_USER_PROFILES, CURRENT_USER_ID } from '@/app/lib/mock-data';
import { isNorthwesternEmail } from '@/app/lib/utils';

// ─── Shared section card ──────────────────────────────────────────────────────

function SectionCard({
  title,
  children,
  danger,
}: {
  title: string;
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <div className={`bg-white rounded-2xl border overflow-hidden ${danger ? 'border-red-200' : 'border-gray-200'}`}>
      <div className={`px-5 py-4 border-b ${danger ? 'border-red-100' : 'border-gray-100'}`}>
        <h2 className={`text-base font-semibold ${danger ? 'text-red-700' : 'text-gray-900'}`}>{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

// ─── Notification preference rows ────────────────────────────────────────────

const NOTIF_PREFS = [
  { key: 'newRequest', label: 'New match request received' },
  { key: 'requestAccepted', label: 'Your match request was accepted' },
  { key: 'subletUnavailable', label: 'Sublet no longer available' },
  { key: 'newMessage', label: 'New message' },
] as const;

type NotifKey = typeof NOTIF_PREFS[number]['key'];

// ─── Password validation ──────────────────────────────────────────────────────

type PwErrors = { current?: string; next?: string; confirm?: string };

function validatePassword(current: string, next: string, confirm: string): PwErrors {
  const errs: PwErrors = {};
  if (!current) errs.current = 'Current password is required.';
  if (!next) errs.next = 'New password is required.';
  else if (next.length < 8) errs.next = 'Password must be at least 8 characters.';
  if (!confirm) errs.confirm = 'Please confirm your new password.';
  else if (next && confirm && next !== confirm) errs.confirm = "Passwords don't match.";
  return errs;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const user = MOCK_USER_PROFILES.find((p) => p.id === CURRENT_USER_ID)!;

  // Notifications
  const [notifs, setNotifs] = useState<Record<NotifKey, boolean>>({
    newRequest: true,
    requestAccepted: true,
    subletUnavailable: true,
    newMessage: true,
  });
  const [savingNotifs, setSavingNotifs] = useState(false);
  const [savedNotifs, setSavedNotifs] = useState(false);

  const saveNotifs = async () => {
    setSavingNotifs(true);
    setSavedNotifs(false);
    await new Promise((r) => setTimeout(r, 400));
    setSavingNotifs(false);
    setSavedNotifs(true);
  };

  // Password
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwErrors, setPwErrors] = useState<PwErrors>({});
  const [savingPw, setSavingPw] = useState(false);
  const [savedPw, setSavedPw] = useState(false);

  const savePassword = async () => {
    const errs = validatePassword(currentPw, newPw, confirmPw);
    if (Object.keys(errs).length > 0) { setPwErrors(errs); return; }
    setPwErrors({});
    setSavingPw(true);
    setSavedPw(false);
    // TODO: replace with NextAuth credentials update when auth is wired up
    await new Promise((r) => setTimeout(r, 500));
    setSavingPw(false);
    setSavedPw(true);
    setCurrentPw('');
    setNewPw('');
    setConfirmPw('');
  };

  // Listing defaults
  const [contactPref, setContactPref] = useState<'messages' | 'email'>('messages');
  const [savingContact, setSavingContact] = useState(false);
  const [savedContact, setSavedContact] = useState(false);

  const saveContact = async () => {
    setSavingContact(true);
    setSavedContact(false);
    await new Promise((r) => setTimeout(r, 400));
    setSavingContact(false);
    setSavedContact(true);
  };

  // Danger zone
  const [deleted, setDeleted] = useState(false);

  if (deleted) {
    return (
      <main className="flex-1 overflow-y-auto p-6 flex items-center justify-center">
        <div className="text-center space-y-2">
          <p className="text-base font-semibold text-gray-700">Account deleted.</p>
          <p className="text-sm text-gray-400">You have been signed out.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 overflow-y-auto p-6 space-y-5">
      <div className="mb-1">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Manage your profile, notifications, and account preferences
        </p>
      </div>

      {/* Profile */}
      <SectionCard title="Profile">
        <EditProfileForm initialName={user.name} initialBio={user.bio} />
        <Separator className="my-5" />
        <VisibilityToggle initialPublic={user.isPublic} />
      </SectionCard>

      {/* Notifications */}
      <SectionCard title="Notifications">
        <div className="space-y-4">
          {NOTIF_PREFS.map(({ key, label }) => (
            <div key={key} className="flex items-center justify-between gap-4">
              <span className="text-sm text-gray-700">{label}</span>
              <Switch
                checked={notifs[key]}
                onCheckedChange={(v) => { setNotifs((p) => ({ ...p, [key]: v })); setSavedNotifs(false); }}
                aria-label={label}
              />
            </div>
          ))}
          <div className="flex items-center gap-3 pt-1 flex-wrap">
            <Button size="sm" disabled={savingNotifs} onClick={saveNotifs}>
              {savingNotifs && <Spinner className="size-3.5 mr-1.5" />}
              {savingNotifs ? 'Saving…' : 'Save preferences'}
            </Button>
            {savedNotifs && (
              <NotificationBanner
                type="success"
                message="Notification preferences saved."
                onDismiss={() => setSavedNotifs(false)}
                className="flex-1"
              />
            )}
          </div>
        </div>
      </SectionCard>

      {/* Account */}
      <SectionCard title="Account">
        <div className="space-y-5">
          {/* Email row */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700">Email</label>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-700 flex-1 min-w-0">
                <LockClosedIcon className="size-3.5 text-gray-400 shrink-0" />
                <span className="truncate">{user.email}</span>
              </div>
              {isNorthwesternEmail(user.email) && (
                <span className="flex items-center gap-1 text-xs text-green-700 bg-green-50 px-2 py-1 rounded-full font-medium shrink-0">
                  <CheckBadgeIcon className="size-3.5" />
                  Northwestern verified
                </span>
              )}
              <Button variant="outline" size="sm" disabled title="Coming soon">
                Change email
              </Button>
            </div>
          </div>

          <Separator />

          {/* Password change */}
          <div className="space-y-3">
            <p className="text-sm font-medium text-gray-700">Change password</p>
            <div className="space-y-2">
              {(
                [
                  { id: 'cur', val: currentPw, set: setCurrentPw, err: pwErrors.current, key: 'current' as const, label: 'Current password' },
                  { id: 'new', val: newPw, set: setNewPw, err: pwErrors.next, key: 'next' as const, label: 'New password' },
                  { id: 'conf', val: confirmPw, set: setConfirmPw, err: pwErrors.confirm, key: 'confirm' as const, label: 'Confirm new password' },
                ]
              ).map(({ id, val, set, err, key, label }) => (
                <div key={id} className="space-y-1">
                  <Input
                    type="password"
                    placeholder={label}
                    value={val}
                    onChange={(e) => { set(e.target.value); setSavedPw(false); setPwErrors((p) => ({ ...p, [key]: undefined })); }}
                    className={err ? 'border-red-400' : ''}
                  />
                  {err && <p className="text-xs text-red-600">{err}</p>}
                </div>
              ))}
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <Button size="sm" disabled={savingPw} onClick={savePassword}>
                {savingPw && <Spinner className="size-3.5 mr-1.5" />}
                {savingPw ? 'Updating…' : 'Update password'}
              </Button>
              {savedPw && (
                <NotificationBanner
                  type="success"
                  message="Password updated."
                  onDismiss={() => setSavedPw(false)}
                  className="flex-1"
                />
              )}
            </div>
          </div>
        </div>
      </SectionCard>

      {/* Listing Defaults */}
      <SectionCard title="Listing Defaults">
        <div className="space-y-3">
          <p className="text-sm text-gray-500">How renters can contact you about your listings</p>
          <div className="space-y-2">
            {(
              [
                { value: 'messages', label: 'Messages only', sub: 'Renters contact you via SubletNU messages' },
                { value: 'email', label: 'Email only', sub: 'Your email address is shown on your listings' },
              ] as const
            ).map(({ value, label, sub }) => (
              <label
                key={value}
                className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                  contactPref === value
                    ? 'border-violet-300 bg-violet-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <input
                  type="radio"
                  name="contact-pref"
                  value={value}
                  checked={contactPref === value}
                  onChange={() => { setContactPref(value); setSavedContact(false); }}
                  className="mt-0.5 accent-violet-600"
                />
                <div>
                  <p className="text-sm font-medium text-gray-900">{label}</p>
                  <p className="text-xs text-gray-500">{sub}</p>
                </div>
              </label>
            ))}
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <Button size="sm" disabled={savingContact} onClick={saveContact}>
              {savingContact && <Spinner className="size-3.5 mr-1.5" />}
              {savingContact ? 'Saving…' : 'Save preference'}
            </Button>
            {savedContact && (
              <NotificationBanner
                type="success"
                message="Listing defaults saved."
                onDismiss={() => setSavedContact(false)}
                className="flex-1"
              />
            )}
          </div>
        </div>
      </SectionCard>

      {/* Danger Zone */}
      <SectionCard title="Danger Zone" danger>
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <p className="text-sm font-medium text-gray-900">Delete account</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Permanently removes your account, all listings, and match requests. This cannot be undone.
              </p>
            </div>
            <ConfirmDialog
              trigger={<Button variant="dangerous" size="sm">Delete account</Button>}
              title="Delete your account?"
              description="All your listings, match requests, and conversations will be permanently deleted. This action cannot be undone."
              confirmLabel="Delete account"
              confirmVariant="dangerous"
              onConfirm={async () => {
                // TODO: call server action to delete account when auth is wired up
                await new Promise((r) => setTimeout(r, 600));
                setDeleted(true);
              }}
            />
          </div>
          <Separator />
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <p className="text-sm font-medium text-gray-900">Export data</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Download a copy of your listings, requests, and messages.
              </p>
            </div>
            <Button variant="outline" size="sm" disabled title="Coming soon">
              Export my data
            </Button>
          </div>
        </div>
      </SectionCard>
    </main>
  );
}
