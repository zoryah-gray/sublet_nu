'use client';

import { useState } from 'react';
import { Switch } from '@/components/ui/switch';
import { GlobeAltIcon } from '@heroicons/react/24/outline';
import NotificationBanner from '@/app/components/notification-banner';

interface VisibilityToggleProps {
  initialPublic: boolean;
}

/** Public profile toggle — flip visibility and persist (TODO: replace delay with server action). */
export default function VisibilityToggle({ initialPublic }: VisibilityToggleProps) {
  const [isPublic, setIsPublic] = useState(initialPublic);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleChange = async (next: boolean) => {
    setIsPublic(next);
    setSaving(true);
    setSaved(false);
    // TODO: replace with server action when auth is wired up
    await new Promise((r) => setTimeout(r, 400));
    setSaving(false);
    setSaved(true);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-2.5">
          <GlobeAltIcon className="size-4 text-gray-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-gray-900">Public profile</p>
            <p className="text-xs text-gray-500 mt-0.5">
              Other Northwestern students can find and view your profile.
            </p>
          </div>
        </div>
        <Switch
          checked={isPublic}
          onCheckedChange={handleChange}
          disabled={saving}
          aria-label="Public profile"
        />
      </div>
      {saved && (
        <NotificationBanner
          type="success"
          message={isPublic ? 'Profile is now public.' : 'Profile is now private.'}
          onDismiss={() => setSaved(false)}
        />
      )}
    </div>
  );
}
