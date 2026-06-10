'use client';

import Link from 'next/link';
import type { MatchRequest } from '@/app/lib/definitions';
import { MATCH_STATUS_STYLES, MATCH_STATUS_LABELS } from '@/app/lib/definitions';
import { relativeTime } from '@/app/lib/utils';
import MessagePreview from '@/app/components/message-preview';

/** Single request row with an expandable message preview. */
function RequestRow({ request }: { request: MatchRequest }) {
  return (
    <div className="flex gap-3 py-3 border-b border-gray-100 last:border-0">
      <div className="size-8 rounded-full bg-violet-100 flex items-center justify-center shrink-0">
        <span className="text-xs font-semibold text-violet-800">{request.requesterInitials}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium text-gray-900">{request.requesterName}</span>
          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${MATCH_STATUS_STYLES[request.status]}`}>
            {MATCH_STATUS_LABELS[request.status]}
          </span>
        </div>
        <MessagePreview message={request.message} />
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
