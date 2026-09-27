'use client';

import { useState } from 'react';
import { HeartIcon } from '@heroicons/react/24/outline';
import { HeartIcon as HeartSolid } from '@heroicons/react/24/solid';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface Props {
  initialFavorited?: boolean;
  onFavoriteChange?: (favorited: boolean) => void;
  /** 'normal' is used in SubletCard, 'mini' in SubletMiniCard */
  size?: 'normal' | 'mini';
  isOwner?: boolean;
}

export default function CardFavoriteButton({
  initialFavorited = false,
  onFavoriteChange,
  size = 'normal',
  isOwner = false,
}: Props) {
  const [favorited, setFavorited] = useState(initialFavorited);
  const [ownerDialogOpen, setOwnerDialogOpen] = useState(false);

  const toggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isOwner) {
      setOwnerDialogOpen(true);
      return;
    }
    const next = !favorited;
    setFavorited(next);
    onFavoriteChange?.(next);
  };

  const isMini = size === 'mini';

  return (
    <>
      <button
        onClick={toggle}
        aria-label={favorited ? 'Remove from favorites' : 'Save to favorites'}
        className={
          isMini
            ? 'absolute top-2 right-2 z-10 p-1.5 rounded-full bg-white/80 backdrop-blur-sm hover:bg-white transition-colors shadow-sm'
            : 'absolute top-2.5 right-2.5 z-10 p-1.5 rounded-full bg-white/80 backdrop-blur-sm hover:bg-white transition-colors shadow-sm'
        }
      >
        {favorited ? (
          <HeartSolid className={isMini ? 'w-3.5 h-3.5 text-red-500' : 'w-4 h-4 text-red-500 cursor-pointer'} />
        ) : (
          <HeartIcon className={isMini ? 'w-3.5 h-3.5 text-gray-400 group-hover:text-gray-500 transition-colors' : 'w-4 h-4 text-gray-400 group-hover:text-gray-500 transition-colors cursor-pointer'} />
        )}
      </button>

      <Dialog open={ownerDialogOpen} onOpenChange={setOwnerDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Can&apos;t save your own listing</DialogTitle>
            <DialogDescription>
              You can&apos;t add your own listing to your favorites. Share the link with others so they can save it!
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setOwnerDialogOpen(false)}>Got it</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
