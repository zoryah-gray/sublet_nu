'use client';

import { TrashIcon } from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/button';
import ConfirmDialog from '@/app/components/confirm-dialog';

interface DeleteConfirmDialogProps {
  subletTitle: string;
  onDelete: () => Promise<void> | void;
}

export default function DeleteConfirmDialog({ subletTitle, onDelete }: DeleteConfirmDialogProps) {
  return (
    <ConfirmDialog
      trigger={
        <Button variant="dangerous" size="xs">
          <TrashIcon className="size-3" />
          Delete
        </Button>
      }
      title="Delete this listing?"
      description={
        <>
          <strong>{subletTitle}</strong> will be permanently deleted. This cannot be undone. All
          associated match requests will also be removed.
        </>
      }
      confirmLabel="Delete listing"
      confirmVariant="dangerous"
      onConfirm={onDelete}
    />
  );
}
