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
import MessagePreview from '@/app/components/message-preview';

type Tab = 'all' | MatchStatus;
type RowState = 'idle' | 'declining' | 'accepted' | 'declined';

const TABS: { label: string; value: Tab }[] = [
  { label: 'All',       value: 'all' },
  { label: 'Pending',   value: 'pending' },
  { label: 'In Talks',  value: 'accepted' },
  { label: 'Confirmed', value: 'confirmed' },
  { label: 'Declined',  value: 'declined' },
];

interface ReceivedRequestsTableProps {
  requests: MatchRequest[];
  fullPage?: boolean;
}

/** Two-role dashboard table for requests received on the owner's listings, with status tab filter. */
export default function ReceivedRequestsTable({ requests, fullPage }: ReceivedRequestsTableProps) {
  const [tab, setTab] = useState<Tab>('all');
  const [rowStates, setRowStates] = useState<Record<string, RowState>>(
    Object.fromEntries(requests.map((r) => [r.id, 'idle']))
  );
  const [declineMsgs, setDeclineMsgs] = useState<Record<string, string>>({});
  const [confirmedIds, setConfirmedIds] = useState<Set<string>>(new Set());

  const setRowState = (id: string, state: RowState) =>
    setRowStates((s) => ({ ...s, [id]: state }));

  const confirmSublet = (id: string) =>
    setConfirmedIds((s) => new Set([...s, id]));

  /** Derives the effective display status, accounting for local accept/decline actions. */
  const effectiveStatus = (r: MatchRequest): MatchStatus => {
    const local = rowStates[r.id];
    if (local === 'accepted') return 'accepted';
    if (local === 'declined') return 'declined';
    if (confirmedIds.has(r.id)) return 'confirmed';
    return r.status;
  };

  const filtered = tab === 'all' ? requests : requests.filter((r) => effectiveStatus(r) === tab);

  const countFor = (t: Tab) =>
    t === 'all' ? requests.length : requests.filter((r) => effectiveStatus(r) === t).length;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100">
        <h2 className="text-base font-semibold text-gray-900">Your Sublet Requests &amp; Matches</h2>
        <p className="text-xs text-gray-400 mt-0.5">Requests received for listings you own</p>
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

      {/* Rows — capped height before scroll: ~3 rows mobile, ~4 on md+ */}
      {filtered.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-8">No requests in this category.</p>
      ) : (
        <div className={cn('divide-y divide-gray-100 mt-2', !fullPage && 'max-h-72 md:max-h-96 overflow-y-auto')}>
          {filtered.map((r) => {
            const state = rowStates[r.id] ?? 'idle';
            const status = effectiveStatus(r);
            const isConfirmed = confirmedIds.has(r.id);

            return (
              <div key={r.id} className={cn('px-5 py-3.5 transition-opacity', status === 'declined' && 'opacity-60')}>
                <div className="flex items-start gap-3">
                  {/* Avatar */}
                  <div className="size-8 rounded-full bg-violet-100 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-xs font-semibold text-violet-800">{r.requesterInitials}</span>
                  </div>

                  {/* Info + actions */}
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/profile/${r.requesterId}`}
                      className="text-sm font-semibold text-gray-900 hover:text-violet-700 transition-colors"
                    >
                      {r.requesterName}
                    </Link>
                    <p className="text-xs text-gray-500 truncate">{r.subletTitle}</p>

                    <MessagePreview message={r.message} className="mt-1" />

                    <div className="mt-1 flex items-center gap-2 flex-wrap">
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${MATCH_STATUS_STYLES[status]}`}>
                        {status === 'accepted' ? 'In Talks' : MATCH_STATUS_LABELS[status]}
                      </span>
                      <span className="text-[11px] text-gray-400">{relativeTime(r.createdAt)}</span>
                    </div>

                    {/* Action row */}
                    <div className="mt-2 flex items-center gap-2 flex-wrap">
                      {/* Pending actions */}
                      {state === 'idle' && r.status === 'pending' && (
                        <>
                          <Button size="xs" onClick={() => setRowState(r.id, 'accepted')}>Accept</Button>
                          <Button variant="outline" size="xs" onClick={() => setRowState(r.id, 'declining')}>
                            Decline
                          </Button>
                        </>
                      )}

                      {/* In-talks actions */}
                      {status === 'accepted' && (
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
                              description="This will archive your listing and notify other requestees that it's no longer available."
                              confirmLabel="Confirm sublet"
                              onConfirm={() => confirmSublet(r.id)}
                            />
                          )}
                          {isConfirmed && (
                            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-violet-50 text-violet-700">
                              Confirmed ✓
                            </span>
                          )}
                        </>
                      )}

                      {/* Confirmed read-only */}
                      {status === 'confirmed' && !isConfirmed && r.threadId && (
                        <Button variant="outline" size="xs" asChild>
                          <Link href={`/messages?thread=${r.threadId}`}>View conversation</Link>
                        </Button>
                      )}
                    </div>

                    {/* Inline decline form */}
                    {state === 'declining' && (
                      <div className="mt-2 space-y-2">
                        <textarea
                          rows={2}
                          placeholder="Optional message to requester…"
                          value={declineMsgs[r.id] ?? ''}
                          onChange={(e) => setDeclineMsgs((s) => ({ ...s, [r.id]: e.target.value }))}
                          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-900 placeholder-gray-400 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 resize-none"
                        />
                        <div className="flex gap-1.5">
                          <Button size="xs" variant="dangerous" onClick={() => setRowState(r.id, 'declined')}>
                            Decline
                          </Button>
                          <Button size="xs" variant="outline" onClick={() => setRowState(r.id, 'idle')}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
