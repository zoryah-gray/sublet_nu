'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const INITIAL_REQUESTS = [
  { id: 'r1', subletTitle: 'Sunny Studio Near Campus',     requester: 'Kelly Tween', status: 'Pending' },
  { id: 'r2', subletTitle: 'Modern 2BR in South Evanston', requester: 'Alex Park',   status: 'Pending' },
];

const STATUS_COLOR: Record<string, string> = {
  Pending:  'bg-amber-100 text-amber-700',
  Accepted: 'bg-green-100 text-green-700',
  Declined: 'bg-red-100 text-red-700',
};

export default function MatchRequestsCard() {
  const [requests, setRequests] = useState(INITIAL_REQUESTS);

  const respond = (id: string, status: 'Accepted' | 'Declined') =>
    setRequests((rs) => rs.map((r) => (r.id === id ? { ...r, status } : r)));

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100">
        <h2 className="text-base font-semibold text-gray-900">Match Requests</h2>
      </div>
      <div className="p-5">
        {requests.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">No pending requests.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {requests.map((r) => (
              <div key={r.id} className="flex items-center gap-3 py-2.5">
                <span className={cn('text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0', STATUS_COLOR[r.status])}>
                  {r.status}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-gray-900 truncate">{r.subletTitle}</p>
                  <p className="text-xs text-gray-500">{r.requester}</p>
                </div>
                {r.status === 'Pending' && (
                  <div className="flex gap-1.5 shrink-0">
                    <Button size="xs" onClick={() => respond(r.id, 'Accepted')}>Accept</Button>
                    <Button variant="outline" size="xs" onClick={() => respond(r.id, 'Declined')}>Decline</Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
