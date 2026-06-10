'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronDownIcon, PencilSquareIcon, MapPinIcon, HomeIcon } from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Sublet, MatchRequest, SubletStatus } from '@/app/lib/definitions';
import {
  QUARTER_COLORS,
  SUBLET_STATUS_STYLES,
  SUBLET_STATUS_LABELS,
} from '@/app/lib/definitions';
import RequestInbox from './request-inbox';
import ArchiveButton from './archive-button';
import DeleteConfirmDialog from './delete-confirm-dialog';

interface ListingCardProps {
  sublet: Sublet;
  requests: MatchRequest[];
}

/** Expandable listing management card shown on the owner's My Listings page. */
export default function ListingCard({ sublet, requests }: ListingCardProps) {
  const [status, setStatus] = useState<SubletStatus>(sublet.status);
  const [deleted, setDeleted] = useState(false);
  const [inboxOpen, setInboxOpen] = useState(false);

  if (deleted) return null;

  const isRented = requests.some((r) => r.status === 'confirmed');
  const inboxId = `inbox-${sublet.id}`;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <div className="flex gap-3 p-4">
        {/* Thumbnail */}
        {sublet.featuredImage ? (
          <img
            src={sublet.featuredImage}
            alt={sublet.title}
            className="w-16 h-16 rounded-xl shrink-0 object-cover sm:w-20 sm:h-20"
          />
        ) : (
          <div
            className="w-16 h-16 rounded-xl shrink-0 flex items-center justify-center sm:w-20 sm:h-20"
            style={{ background: `hsl(${sublet.imageHue} 60% 85%)` }}
          >
            <HomeIcon
              className="size-7 dark:text-neutral-600"
              style={{ color: `hsl(${sublet.imageHue} 50% 50%)` }}
            />
          </div>
        )}

        {/* Info + action bar stacked in one column */}
        <div className="flex flex-col flex-1 min-w-0 gap-1.5">
          {/* Title + status badge */}
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-gray-900 truncate">{sublet.title}</p>
            {isRented ? (
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0 bg-violet-50 text-violet-700">
                Rented
              </span>
            ) : (
              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${SUBLET_STATUS_STYLES[status]}`}>
                {SUBLET_STATUS_LABELS[status]}
              </span>
            )}
          </div>

          {/* Address */}
          <div className="flex items-center gap-1 text-xs text-gray-400">
            <MapPinIcon className="size-3 shrink-0" />
            <span className="truncate">{sublet.address}</span>
          </div>

          {/* Price + specs */}
          <p className="text-xs font-medium text-violet-700">
            ${sublet.price.toLocaleString()}/mo · {sublet.beds === 0 ? 'Studio' : `${sublet.beds} bed`} · {sublet.baths} bath
          </p>

          {/* Quarter badges */}
          <div className="flex flex-wrap gap-1">
            {sublet.quarters.map((q) => (
              <span key={q} className={`text-[11px] px-1.5 py-0.5 rounded-full font-medium ${QUARTER_COLORS[q]}`}>
                {q}
              </span>
            ))}
          </div>

          {/* Action bar: request count left, buttons right */}
          <div className="flex items-center justify-between gap-2 mt-1 flex-wrap">
            <button
              onClick={() => setInboxOpen((o) => !o)}
              aria-expanded={inboxOpen}
              aria-controls={inboxId}
              className={cn(
                'flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full border transition-colors',
                inboxOpen
                  ? 'bg-violet-50 text-violet-700 border-violet-200'
                  : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100',
              )}
            >
              {requests.length} request{requests.length !== 1 ? 's' : ''}
              <ChevronDownIcon className={cn('size-3 transition-transform', inboxOpen && 'rotate-180')} />
            </button>

            <div className="flex items-center gap-1.5 flex-wrap">
              <Button variant="outline" size="xs" asChild>
                <Link href={`/listings/${sublet.id}/edit`}>
                  <PencilSquareIcon className="size-3" />
                  Edit
                </Link>
              </Button>
              <ArchiveButton
                subletTitle={sublet.title}
                isArchived={status === 'archived'}
                onArchive={() => setStatus('archived')}
                onUnarchive={() => setStatus('active')}
              />
              <DeleteConfirmDialog
                subletTitle={sublet.title}
                onDelete={() => setDeleted(true)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Expandable request inbox */}
      {inboxOpen && (
        <div id={inboxId} className="border-t border-gray-100 px-4 pb-2">
          <RequestInbox requests={requests} />
        </div>
      )}
    </div>
  );
}
