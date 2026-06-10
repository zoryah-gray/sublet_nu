'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { EnrichedRequest, MatchStatus } from '@/app/lib/definitions';
import { MATCH_STATUS_STYLES, MATCH_STATUS_LABELS } from '@/app/lib/definitions';
import ConfirmDialog from '@/app/components/confirm-dialog';
import { relativeTime } from '@/app/lib/utils';

interface Props { requests: EnrichedRequest[]; }

/** Spacious card grid — two sections (Received + Sent), each in a 2-col grid of cards. */
export default function CardsLayout({ requests }: Props) {
  const [acceptedIds,  setAcceptedIds]  = useState<Set<string>>(new Set());
  const [declinedIds,  setDeclinedIds]  = useState<Set<string>>(new Set());
  const [confirmedIds, setConfirmedIds] = useState<Set<string>>(new Set());
  const [withdrawnIds, setWithdrawnIds] = useState<Set<string>>(new Set());
  const [decliningId,  setDecliningId]  = useState<string | null>(null);
  const [declineMsgs,  setDeclineMsgs]  = useState<Record<string, string>>({});

  const effectiveStatus = (r: EnrichedRequest): MatchStatus => {
    if (acceptedIds.has(r.id))  return 'accepted';
    if (declinedIds.has(r.id))  return 'declined';
    if (confirmedIds.has(r.id)) return 'confirmed';
    return r.status;
  };

  const received = requests.filter((r) => r.role === 'received');
  const sent     = requests.filter((r) => r.role === 'sent');

  function RequestCard({ r }: { r: EnrichedRequest }) {
    const status = effectiveStatus(r);
    const isWithdrawn = withdrawnIds.has(r.id);
    const isDeclining = decliningId === r.id;
    const isConfirmed = confirmedIds.has(r.id);

    return (
      <div className={cn(
        'rounded-xl border border-gray-200 bg-white shadow-sm flex flex-col',
        (status === 'declined' || isWithdrawn) && 'opacity-50',
      )}>
        {/* Card header */}
        <div className="p-4 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className={cn(
              'size-10 rounded-full flex items-center justify-center shrink-0',
              r.role === 'received' ? 'bg-violet-100' : 'bg-gray-100',
            )}>
              <span className={cn(
                'text-sm font-bold',
                r.role === 'received' ? 'text-violet-800' : 'text-gray-500',
              )}>
                {r.role === 'received' ? r.requesterInitials : 'YOU'}
              </span>
            </div>
            <div className="min-w-0">
              {r.role === 'received' ? (
                r.isRequesterPublic ? (
                  <Link href={`/profile/${r.requesterId}`} className="text-sm font-semibold text-gray-900 hover:text-violet-700 transition-colors block truncate">
                    {r.requesterName}
                  </Link>
                ) : (
                  <p className="text-sm font-semibold text-gray-900 truncate">{r.requesterName}</p>
                )
              ) : (
                <p className="text-sm font-semibold text-gray-500">You applied</p>
              )}
              <Link href={`/sublet/${r.subletId}`} className="text-xs text-gray-500 hover:text-violet-700 transition-colors truncate block">
                {r.subletTitle}
              </Link>
            </div>
          </div>
          <span className={cn(
            'text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0',
            isWithdrawn ? 'bg-gray-100 text-gray-400' : MATCH_STATUS_STYLES[status],
          )}>
            {isWithdrawn ? 'Withdrawn' : status === 'accepted' ? 'In Talks' : MATCH_STATUS_LABELS[status]}
          </span>
        </div>

        {/* Price */}
        <div className="px-4 pb-2">
          <span className="text-lg font-bold text-violet-700">${r.price.toLocaleString()}</span>
          <span className="text-xs text-gray-400">/mo</span>
          {r.role === 'sent' && (
            <span className="ml-2 text-xs text-gray-500">
              {r.isOwnerPublic ? (
                <Link href={`/profile/${r.ownerId}`} className="hover:text-violet-700 transition-colors">
                  {r.ownerName}
                </Link>
              ) : r.ownerName}
            </span>
          )}
        </div>

        {/* Message preview */}
        {r.role === 'received' && r.message && (
          <div className="mx-4 mb-3 px-3 py-2 bg-gray-50 rounded-lg text-xs text-gray-600 line-clamp-2 leading-relaxed">
            {r.message}
          </div>
        )}

        {/* Footer: time + actions */}
        <div className="mt-auto px-4 pb-4 pt-3 border-t border-gray-100 space-y-2">
          <p className="text-[11px] text-gray-400">{relativeTime(r.createdAt)}</p>

          {!isWithdrawn && status !== 'declined' && (
            <div className="flex flex-wrap gap-1.5">
              {/* Received pending */}
              {r.role === 'received' && status === 'pending' && !isDeclining && (
                <>
                  <Button size="xs" onClick={() => setAcceptedIds((s) => new Set([...s, r.id]))}>Accept</Button>
                  <Button variant="outline" size="xs" onClick={() => setDecliningId(r.id)}>Decline</Button>
                </>
              )}

              {/* Received in-talks */}
              {r.role === 'received' && status === 'accepted' && (
                <>
                  {r.threadId && (
                    <Button variant="outline" size="xs" asChild>
                      <Link href={`/messages?thread=${r.threadId}`}>View conversation</Link>
                    </Button>
                  )}
                  {!isConfirmed && (
                    <ConfirmDialog
                      trigger={<Button size="xs">Confirm Sublet</Button>}
                      title={`Confirm sublet to ${r.requesterName}?`}
                      description="This will archive your listing and notify other requestees it's no longer available."
                      confirmLabel="Confirm sublet"
                      onConfirm={() => setConfirmedIds((s) => new Set([...s, r.id]))}
                    />
                  )}
                  {isConfirmed && (
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-violet-50 text-violet-700">Confirmed ✓</span>
                  )}
                </>
              )}

              {/* Received confirmed */}
              {r.role === 'received' && status === 'confirmed' && !isConfirmed && r.threadId && (
                <Button variant="outline" size="xs" asChild>
                  <Link href={`/messages?thread=${r.threadId}`}>View conversation</Link>
                </Button>
              )}

              {/* Sent in-talks / confirmed */}
              {r.role === 'sent' && (status === 'accepted' || status === 'confirmed') && r.threadId && (
                <Button variant="outline" size="xs" asChild>
                  <Link href={`/messages?thread=${r.threadId}`}>View conversation</Link>
                </Button>
              )}

              {/* Sent withdraw */}
              {r.role === 'sent' && (status === 'pending' || status === 'accepted') && (
                <ConfirmDialog
                  trigger={<Button variant="outline" size="xs">Withdraw</Button>}
                  title="Withdraw this application?"
                  description={`You'll be removed from the request queue for ${r.subletTitle}.`}
                  confirmLabel="Withdraw"
                  confirmVariant="dangerous"
                  onConfirm={() => setWithdrawnIds((s) => new Set([...s, r.id]))}
                />
              )}
            </div>
          )}

          {/* Decline form */}
          {isDeclining && (
            <div className="space-y-2">
              <textarea
                rows={2}
                placeholder="Optional message to requester…"
                value={declineMsgs[r.id] ?? ''}
                onChange={(e) => setDeclineMsgs((s) => ({ ...s, [r.id]: e.target.value }))}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-900 placeholder-gray-400 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 resize-none"
              />
              <div className="flex gap-1.5">
                <Button size="xs" variant="dangerous" onClick={() => { setDeclinedIds((s) => new Set([...s, r.id])); setDecliningId(null); }}>
                  Decline
                </Button>
                <Button size="xs" variant="outline" onClick={() => setDecliningId(null)}>Cancel</Button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Received section */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Received Requests</h2>
        {received.length === 0 ? (
          <p className="text-sm text-gray-400 py-4">No requests received yet.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {received.map((r) => <RequestCard key={r.id} r={r} />)}
          </div>
        )}
      </div>

      {/* Sent section */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Your Applications</h2>
        {sent.length === 0 ? (
          <p className="text-sm text-gray-400 py-4">You haven&apos;t applied to any sublets yet.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {sent.map((r) => <RequestCard key={r.id} r={r} />)}
          </div>
        )}
      </div>
    </div>
  );
}
