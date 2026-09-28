'use client';

import ConfirmDialog from '@/app/components/confirm-dialog';
import { Button } from '@/components/ui/button';
import type { ConfirmSubletButtonProps } from '@/app/lib/definitions';

/** Confirm-sublet action for use in conversation headers and match cards. */
export default function ConfirmSubletButton({ requesterName, onConfirm }: ConfirmSubletButtonProps) {
  return (
    <ConfirmDialog
      trigger={<Button size="xs">Confirm Sublet</Button>}
      title={`Confirm sublet to ${requesterName}?`}
      description="This will archive your listing and notify other requestees that it's no longer available."
      confirmLabel="Confirm sublet"
      onConfirm={onConfirm}
    />
  );
}
