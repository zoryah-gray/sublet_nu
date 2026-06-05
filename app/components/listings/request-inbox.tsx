'use client';

import Link from 'next/link';
import type { MatchRequest, MatchStatus } from '@/app/lib/mock-data';

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const STATUS_STYLES: Record<MatchStatus, string> = {
  pending:   'bg-amber-50 text-amber-700',
  accepted:  'bg-green-50 text-green-700',
  declined:  'bg-red-50 text-red-700',
  confirmed: 'bg-violet-50 text-violet-700',
};

const STATUS_LABELS: Record<MatchStatus, string> = {
  pending:   'Pending',
  accepted:  'Accepted',
  declined:  'Declined',
  confirmed: 'Confirmed',
};

function RequestRow({ request }: { request: MatchRequest }) {
  return (
    <div className="flex gap-3 py-3 border-b border-gray-100 last:border-0">
      <div className="size-8 rounded-full bg-violet-100 flex items-center justify-center shrink-0">
        <span className="text-xs font-semibold text-violet-800">{request.requesterInitials}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium text-gray-900">{request.requesterName}</span>
          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${STATUS_STYLES[request.status]}`}>
            {STATUS_LABELS[request.status]}
          </span>
        </div>
        {request.message ? (
          <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{request.message}</p>
        ) : (
          <p className="text-xs text-gray-400 italic mt-0.5">No message attached</p>
        )}
        <div className="flex items-center justify-between mt-1">
          <span className="text-[11px] text-gray-400">{relativeTime(request.createdAt)}</span>
          {request.threadId && (
            <Link
              href={`/messages?thread=${request.threadId}`}
              className="text-[11px] text-violet-700 hover:underline font-medium"
            >
              View in messages →
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

interface RequestInboxProps {
  requests: MatchRequest[];
}

export default function RequestInbox({ requests }: RequestInboxProps) {
  if (requests.length === 0) {
    return <p className="text-sm text-gray-400 text-center py-4">No requests yet.</p>;
  }
  return (
    <div>
      {requests.map((req) => (
        <RequestRow key={req.id} request={req} />
      ))}
    </div>
  );
}
