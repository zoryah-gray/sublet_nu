'use client';

import { cn } from '@/lib/utils';
import type { Thread, MatchRequest } from '@/app/lib/definitions';
import { MATCH_STATUS_STYLES, MATCH_STATUS_LABELS } from '@/app/lib/definitions';

/** Single row in the thread list. Shows match status chip when the thread is match-linked. */
export default function ThreadRow({
  thread,
  active,
  onClick,
  matchRequest,
}: {
  thread: Thread;
  active: boolean;
  onClick: () => void;
  matchRequest?: MatchRequest;
}) {
  const showChip = matchRequest?.status === 'accepted' || matchRequest?.status === 'confirmed';

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50 border-b border-gray-100',
        active && 'bg-violet-50 hover:bg-violet-50'
      )}
    >
      {/* Avatar */}
      <div className="w-9 h-9 rounded-full bg-violet-100 flex items-center justify-center shrink-0">
        <span className="text-xs font-bold text-violet-800">{thread.initials}</span>
      </div>

      {/* Name + preview */}
      <div className="flex-1 min-w-0 overflow-hidden">
        {/* Row 1: name + timestamp */}
        <div className="flex items-baseline gap-2">
          <span className={cn('text-sm min-w-0 flex-1 truncate leading-snug', active ? 'font-semibold text-violet-900' : 'font-medium text-gray-900')}>
            {thread.name}
          </span>
          <span className="text-[11px] text-gray-400 shrink-0 whitespace-nowrap leading-snug">{thread.timestamp}</span>
        </div>
        {/* Row 2: preview + match chip */}
        <div className="flex items-center gap-2 mt-0.5">
          <p className="text-xs text-gray-500 truncate flex-1">{thread.preview}</p>
          {showChip && (
            <span className={cn('shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full', MATCH_STATUS_STYLES[matchRequest!.status])}>
              {MATCH_STATUS_LABELS[matchRequest!.status]}
            </span>
          )}
        </div>
      </div>

      {/* Unread badge */}
      {thread.unread > 0 && (
        <span className="shrink-0 min-w-4.5 h-4.5 rounded-full bg-violet-700 text-white text-[10px] font-bold flex items-center justify-center px-1">
          {thread.unread}
        </span>
      )}
    </button>
  );
}
