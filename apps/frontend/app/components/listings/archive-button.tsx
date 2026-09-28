'use client';

import { ArchiveBoxIcon, ArchiveBoxXMarkIcon } from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/button';
import ConfirmDialog from '@/app/components/confirm-dialog';

interface ArchiveButtonProps {
  subletTitle: string;
  isArchived: boolean;
  onArchive: () => Promise<void> | void;
  onUnarchive: () => Promise<void> | void;
}

export default function ArchiveButton({
  subletTitle,
  isArchived,
  onArchive,
  onUnarchive,
}: ArchiveButtonProps) {
  if (isArchived) {
    return (
      <ConfirmDialog
        trigger={
          <Button variant="outline" size="xs">
            <ArchiveBoxXMarkIcon className="size-3" />
            Restore
          </Button>
        }
        title="Restore this listing?"
        description={
          <>
            <strong>{subletTitle}</strong> will be re-listed on browse and open to new requests.
          </>
        }
        confirmLabel="Restore listing"
        onConfirm={onUnarchive}
      />
    );
  }

  return (
    <ConfirmDialog
      trigger={
        <Button variant="outline" size="xs">
          <ArchiveBoxIcon className="size-3" />
          Archive
        </Button>
      }
      title="Archive this listing?"
      description={
        <>
          <strong>{subletTitle}</strong> will be hidden from public browse and new requests will be
          disabled. Existing conversations and data are preserved. You can restore it later.
        </>
      }
      confirmLabel="Archive listing"
      onConfirm={onArchive}
    />
  );
}
