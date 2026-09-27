'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import type { MatchRequest, MatchStatus } from '@/app/lib/definitions';
import { MATCH_STATUS_STYLES, MATCH_STATUS_LABELS } from '@/app/lib/definitions';
import ConfirmDialog from '@/app/components/confirm-dialog';
import { relativeTime } from '@/app/lib/utils';

export type SentRequestRow = MatchRequest & {
  price: number;
  ownerName: string;
  isOwnerPublic: boolean;
};

type Tab = 'all' | MatchStatus | 'withdrawn';

const TABS: { label: string; value: Tab }[] = [
  { label: 'All',       value: 'all' },
  { label: 'Pending',   value: 'pending' },
  { label: 'In Talks',  value: 'accepted' },
  { label: 'Confirmed', value: 'confirmed' },
  { label: 'Declined',  value: 'declined' },
];

interface SentRequestsTableProps {
  requests: SentRequestRow[];
  fullPage?: boolean;
}

/** Two-role dashboard table for requests the current user sent as a renter, with status tab filter. */
export default function SentRequestsTable({ requests, fullPage }: SentRequestsTableProps) {
  const [tab, setTab] = useState<Tab>('all');
  const [withdrawn, setWithdrawn] = useState<Set<string>>(new Set());

  /**
   * Optimistically marks the request as withdrawn in UI.
   * TODO: replace with a server action that sends a notification to the sublet
   * owner via SQS and deletes the MatchRequest row in the DB.
   */
  const withdraw = (id: string) => setWithdrawn((s) => new Set([...s, id]));

  const isWithdrawn = (id: string) => withdrawn.has(id);

  const effectiveTab = (r: SentRequestRow): Tab =>
    isWithdrawn(r.id) ? 'withdrawn' : r.status;

  const filtered =
    tab === 'all'
      ? requests.filter((r) => !isWithdrawn(r.id))
      : requests.filter((r) => effectiveTab(r) === tab);

  const countFor = (t: Tab) =>
    t === 'all'
      ? requests.filter((r) => !isWithdrawn(r.id)).length
      : requests.filter((r) => effectiveTab(r) === t).length;

  const canWithdraw = (r: SentRequestRow) =>
    r.status === 'pending' || r.status === 'accepted';

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100">
        <h2 className="text-base font-semibold text-gray-900">Sent Requests &amp; Matches</h2>
        <p className="text-xs text-gray-400 mt-0.5">Requests you sent to other sublets as a renter</p>
      </div>

      {/* Tab bar */}
      <div className="px-5 pt-3">
        <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
          <TabsList className="w-full">
            {TABS.map((t) => {
              const count = countFor(t.value);
              return (
                <TabsTrigger key={t.value} value={t.value} className="flex-1 min-w-0 gap-0.5">
                  <span className="truncate text-[11px] sm:text-sm">{t.label}</span>
                  {count > 0 && (
                    <span className="hidden sm:inline text-[10px] font-semibold px-1 py-0.5 rounded-full bg-gray-200 text-gray-600 min-w-4 text-center shrink-0">
                      {count}
                    </span>
                  )}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </Tabs>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-8">No requests in this category.</p>
      ) : (
        <div className={cn('divide-y divide-gray-100 mt-2', !fullPage && 'max-h-72 md:max-h-96 overflow-y-auto')}>
          {filtered.map((r) => {
            const gone = isWithdrawn(r.id);
            return (
              <div key={r.id} className={cn('px-5 py-3.5 transition-opacity', gone && 'opacity-40')}>
                <div className="flex-1 min-w-0">
                  {/* Title + status */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link
                      href={`/sublet/${r.subletId}`}
                      className="text-sm font-semibold text-gray-900 hover:text-violet-700 transition-colors truncate"
                    >
                      {r.subletTitle}
                    </Link>
                    <span
                      className={cn(
                        'text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0',
                        gone ? 'bg-gray-100 text-gray-400' : MATCH_STATUS_STYLES[r.status]
                      )}
                    >
                      {gone ? 'Withdrawn' : r.status === 'accepted' ? 'In Talks' : MATCH_STATUS_LABELS[r.status]}
                    </span>
                  </div>

                  {/* Price + owner */}
                  <div className="flex items-center gap-1.5 mt-0.5 text-xs text-gray-500 flex-wrap">
                    <span className="font-medium text-violet-700">${r.price.toLocaleString()}/mo</span>
                    <span>·</span>
                    <Link href={`/profile/${r.ownerId}`} className="hover:text-violet-700 transition-colors">
                      {r.ownerName}
                    </Link>
                  </div>

                  <p className="text-[11px] text-gray-400 mt-0.5">{relativeTime(r.createdAt)}</p>

                  {/* Action row */}
                  {!gone && (
                    <div className="mt-2 flex items-center gap-2 flex-wrap">
                      {(r.status === 'accepted' || r.status === 'confirmed') && r.threadId && (
                        <Button variant="outline" size="xs" asChild>
                          <Link href={`/messages?thread=${r.threadId}`}>View conversation</Link>
                        </Button>
                      )}
                      {canWithdraw(r) && (
                        <ConfirmDialog
                          trigger={<Button variant="outline" size="xs">Withdraw</Button>}
                          title="Withdraw this application?"
                          description={`You'll be removed from the request queue for ${r.subletTitle}. This cannot be undone.`}
                          confirmLabel="Withdraw"
                          confirmVariant="dangerous"
                          onConfirm={() => withdraw(r.id)}
                        />
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
