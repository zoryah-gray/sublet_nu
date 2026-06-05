'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronDownIcon, PencilSquareIcon, MapPinIcon } from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Sublet, MatchRequest, SubletStatus } from '@/app/lib/mock-data';
import RequestInbox from './request-inbox';
import ArchiveButton from './archive-button';
import DeleteConfirmDialog from './delete-confirm-dialog';

const QUARTER_COLORS: Record<string, string> = {
  Fall:   'bg-amber-50 text-amber-700',
  Winter: 'bg-sky-50 text-sky-700',
  Spring: 'bg-green-50 text-green-700',
  Summer: 'bg-orange-50 text-orange-700',
};

const STATUS_STYLES: Record<SubletStatus, string> = {
  active:   'bg-green-50 text-green-700',
  archived: 'bg-gray-100 text-gray-500',
  draft:    'bg-amber-50 text-amber-700',
};

const STATUS_LABELS: Record<SubletStatus, string> = {
  active:   'Active',
  archived: 'Archived',
  draft:    'Draft',
};

interface ListingCardProps {
  sublet: Sublet;
  requests: MatchRequest[];
}

export default function ListingCard({ sublet, requests }: ListingCardProps) {
  const [status, setStatus] = useState<SubletStatus>(sublet.status);
  const [deleted, setDeleted] = useState(false);
  const [inboxOpen, setInboxOpen] = useState(false);

  if (deleted) return null;

  const isRented = requests.some((r) => r.status === 'confirmed');

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <div className="flex gap-4 p-4">
        {/* Thumbnail */}
        {sublet.featuredImage ? (
          <img
            src={sublet.featuredImage}
            alt={sublet.title}
            className="w-20 h-20 rounded-xl shrink-0 object-cover"
          />
        ) : (
          <div
            className="w-20 h-20 rounded-xl shrink-0"
            style={{ background: `hsl(${sublet.imageHue} 60% 85%)` }}
          />
        )}

        {/* Center info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-gray-900 truncate">{sublet.title}</p>
            {isRented ? (
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0 bg-violet-50 text-violet-700">
                Rented
              </span>
            ) : (
              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${STATUS_STYLES[status]}`}>
                {STATUS_LABELS[status]}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 mt-0.5 text-xs text-gray-400">
            <MapPinIcon className="size-3 shrink-0" />
            <span className="truncate">{sublet.address}</span>
          </div>
          <p className="text-xs font-medium text-violet-700 mt-0.5">
            ${sublet.price.toLocaleString()}/mo · {sublet.beds === 0 ? 'Studio' : `${sublet.beds} bed`} · {sublet.baths} bath
          </p>
          <div className="flex flex-wrap gap-1 mt-1.5">
            {sublet.quarters.map((q) => (
              <span key={q} className={`text-[11px] px-1.5 py-0.5 rounded-full font-medium ${QUARTER_COLORS[q]}`}>
                {q}
              </span>
            ))}
          </div>
        </div>

        {/* Right controls */}
        <div className="flex flex-col items-end gap-2 shrink-0">
          {/* Request count pill */}
          <button
            onClick={() => setInboxOpen((o) => !o)}
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

          {/* Action buttons */}
          <div className="flex items-center gap-1.5 flex-wrap justify-end">
            <Button variant="outline" size="xs" asChild>
              <Link href={`/listings/${sublet.id}/edit`}>
                <PencilSquareIcon className="size-3" />
                Edit
              </Link>
            </Button>
            <ArchiveButton
              subletTitle={sublet.title}
              isArchived={status === 'archived'}
              onArchive={async () => setStatus('archived')}
              onUnarchive={async () => setStatus('active')}
            />
            <DeleteConfirmDialog
              subletTitle={sublet.title}
              onDelete={async () => setDeleted(true)}
            />
          </div>
        </div>
      </div>

      {/* Inline inbox */}
      {inboxOpen && (
        <div className="border-t border-gray-100 px-4 pb-2">
          <RequestInbox requests={requests} />
        </div>
      )}
    </div>
  );
}
