'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import NotificationBanner from '@/app/components/notification-banner';
import { toInitials } from '@/app/lib/utils';
import type { EditProfileFormProps } from '@/app/lib/definitions';

type Errors = { name?: string; bio?: string };

function validate(name: string, bio: string): Errors {
  const errs: Errors = {};
  if (!name.trim()) errs.name = 'Display name is required.';
  else if (name.trim().length < 2) errs.name = 'Display name must be at least 2 characters.';
  if (bio.length > 300) errs.bio = 'Bio must be 300 characters or less.';
  return errs;
}

/** Profile name + bio form with live avatar preview and field validation. TODO: replace save with server action. */
export default function EditProfileForm({ initialName, initialBio }: EditProfileFormProps) {
  const [name, setName]       = useState(initialName);
  const [bio, setBio]         = useState(initialBio);
  const [errors, setErrors]   = useState<Errors>({});
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);

  const handleSave = async () => {
    const errs = validate(name, bio);
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setErrors({});
    setSaving(true);
    setSaved(false);
    // TODO: replace with server action + revalidatePath('/dashboard') when auth is wired up
    await new Promise((r) => setTimeout(r, 500));
    setSaving(false);
    setSaved(true);
  };

  return (
    <div className="space-y-4">
      {/* Live avatar preview */}
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-violet-100 flex items-center justify-center shrink-0">
          <span className="text-lg font-bold text-violet-800">{toInitials(name)}</span>
        </div>
        <div>
          <p className="text-sm font-medium text-gray-700">Profile photo</p>
          <p className="text-xs text-gray-400 mt-0.5">Initials generated from your display name.</p>
        </div>
      </div>

      {/* Display name */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-gray-700" htmlFor="display-name">
          Display name
        </label>
        <Input
          id="display-name"
          value={name}
          onChange={(e) => { setName(e.target.value); setSaved(false); setErrors((p) => ({ ...p, name: undefined })); }}
          placeholder="Your name"
          maxLength={80}
          className={errors.name ? 'border-red-400 focus-visible:ring-red-200' : ''}
        />
        {errors.name && <p className="text-xs text-red-600">{errors.name}</p>}
      </div>

      {/* Bio */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-gray-700" htmlFor="bio">
          Bio
        </label>
        <textarea
          id="bio"
          value={bio}
          onChange={(e) => { setBio(e.target.value); setSaved(false); setErrors((p) => ({ ...p, bio: undefined })); }}
          placeholder="Tell other students a bit about yourself…"
          rows={3}
          maxLength={300}
          className={`w-full rounded-lg border px-3 py-2 text-sm text-gray-900 placeholder-gray-400 outline-none focus:ring-2 resize-none ${
            errors.bio
              ? 'border-red-400 focus:border-red-400 focus:ring-red-100'
              : 'border-gray-200 focus:border-violet-400 focus:ring-violet-100'
          }`}
        />
        <div className="flex items-center justify-between">
          {errors.bio
            ? <p className="text-xs text-red-600">{errors.bio}</p>
            : <span />}
          <p className={`text-xs ${bio.length > 280 ? 'text-amber-600' : 'text-gray-400'}`}>
            {bio.length}/300
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <Button onClick={handleSave} disabled={saving} size="sm">
          {saving && <Spinner className="size-3.5 mr-1.5" />}
          {saving ? 'Saving…' : 'Save profile'}
        </Button>
        {saved && (
          <NotificationBanner
            type="success"
            message="Profile updated."
            onDismiss={() => setSaved(false)}
            className="flex-1"
          />
        )}
      </div>
    </div>
  );
}
