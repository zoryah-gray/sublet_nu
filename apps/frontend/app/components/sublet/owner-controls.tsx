'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { PencilSquareIcon, ArchiveBoxIcon, TrashIcon } from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

type Action = 'archive' | 'delete' | null;

interface OwnerControlsProps {
  subletId: string;
  subletTitle: string;
}

export default function OwnerControls({ subletId, subletTitle }: OwnerControlsProps) {
  const router = useRouter();
  const [pendingAction, setPendingAction] = useState<Action>(null);
  const [loading, setLoading] = useState(false);

  const confirm = async () => {
    setLoading(true);
    // TODO: call API — for now simulate delay and navigate
    await new Promise((r) => setTimeout(r, 600));
    setLoading(false);
    setPendingAction(null);
    router.push('/listings');
  };

  return (
    <div className="flex items-center gap-2">
      {/* Edit */}
      <Button variant="outline" size="sm" asChild>
        <Link href={`/listings/${subletId}/edit`}>
          <PencilSquareIcon className="size-4 mr-1.5" />
          Edit
        </Link>
      </Button>

      {/* Archive */}
      <Dialog
        open={pendingAction === 'archive'}
        onOpenChange={(open) => setPendingAction(open ? 'archive' : null)}
      >
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <ArchiveBoxIcon className="size-4 mr-1.5" />
            Archive
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Archive this listing?</DialogTitle>
            <DialogDescription>
              <strong>{subletTitle}</strong> will be hidden from public browse and new requests will be
              disabled. Existing conversations and data are preserved. You can restore it later from
              your listings.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingAction(null)} disabled={loading}>
              Cancel
            </Button>
            <Button onClick={confirm} disabled={loading}>
              {loading ? 'Archiving…' : 'Archive listing'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete */}
      <Dialog
        open={pendingAction === 'delete'}
        onOpenChange={(open) => setPendingAction(open ? 'delete' : null)}
      >
        <DialogTrigger asChild>
          <Button variant="dangerous" size="sm">
            <TrashIcon className="size-4 mr-1.5" />
            Delete
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this listing?</DialogTitle>
            <DialogDescription>
              <strong>{subletTitle}</strong> will be permanently deleted. This cannot be undone.
              All associated match requests will also be removed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingAction(null)} disabled={loading}>
              Cancel
            </Button>
            <Button variant="dangerous" onClick={confirm} disabled={loading}>
              {loading ? 'Deleting…' : 'Delete listing'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
