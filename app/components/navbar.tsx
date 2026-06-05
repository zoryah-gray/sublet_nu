'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Bars3Icon, UserCircleIcon, BellIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { BellIcon as BellSolid } from '@heroicons/react/24/solid';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useNotifications } from '@/app/context/notifications';
import type { Notification } from '@/app/lib/mock-data';
import NavSidebar from './nav-sidebar';

const KIND_BADGE: Record<Notification['kind'], { label: string; className: string }> = {
  request:  { label: 'Request',  className: 'bg-amber-100 text-amber-700' },
  message:  { label: 'Message',  className: 'bg-violet-100 text-violet-700' },
  accepted: { label: 'Accepted', className: 'bg-green-100 text-green-700' },
};

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function NavBar() {
  const [showNav, setShowNav] = useState(false);
  const [open, setOpen] = useState(false);

  const { notifications, hasUnread, hasSeen, onBellOpen, onBellClose, dismissOne, clearAll } =
    useNotifications();

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) onBellOpen();
    else onBellClose();
  };

  const showDot = (hasUnread || hasSeen) && notifications.length > 0;

  return (
    <>
      <nav className="h-15 bg-white border-b border-gray-200 flex items-center justify-between px-4 shrink-0">
        <button
          onClick={() => setShowNav(true)}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-600"
          aria-label="Open menu"
        >
          <Bars3Icon className="w-5 h-5" />
        </button>

        <Link
          href="/"
          className="text-xl font-bold text-violet-800 tracking-tight hover:text-violet-900 transition-colors"
        >
          SubletNU
        </Link>

        <div className="flex items-center gap-1">
          {/* Bell */}
          <Popover open={open} onOpenChange={handleOpenChange}>
            <PopoverTrigger asChild>
              <button
                className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-500"
                aria-label="Notifications"
              >
                {hasUnread ? (
                  <BellSolid className="w-5 h-5 text-gray-700" />
                ) : (
                  <BellIcon className="w-5 h-5" />
                )}
                {showDot && (
                  <span
                    data-testid="notif-dot"
                    data-state={hasUnread ? 'unread' : 'seen'}
                    className={cn(
                      'absolute top-1.5 right-1.5 size-2 rounded-full',
                      hasUnread ? 'bg-red-500' : 'bg-gray-400'
                    )}
                  />
                )}
              </button>
            </PopoverTrigger>

            <PopoverContent align="end" className="w-80 p-0 shadow-lg">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-sm font-semibold text-gray-900">Notifications</span>
                <div className="flex items-center gap-2">
                  {notifications.length > 0 && (
                    <button
                      onClick={clearAll}
                      className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      Clear all
                    </button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => setOpen(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <XMarkIcon className="size-3.5" />
                  </Button>
                </div>
              </div>

              <Separator />

              {/* List */}
              {notifications.length === 0 ? (
                <div className="py-8 flex flex-col items-center gap-1 text-center">
                  <BellIcon className="size-7 text-gray-300" />
                  <p className="text-sm text-gray-400 mt-1">No notifications</p>
                </div>
              ) : (
                <ul className="max-h-80 overflow-y-auto divide-y divide-gray-100">
                  {notifications.map((n) => {
                    const badge = KIND_BADGE[n.kind];
                    return (
                      <li key={n.id} className={cn('px-4 py-3 flex gap-3 group', !n.read && 'bg-violet-50/50')}>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className={cn('text-[11px] font-semibold px-1.5 py-0.5 rounded-full', badge.className)}>
                              {badge.label}
                            </span>
                            <span className="text-[11px] text-gray-400 ml-auto shrink-0">
                              {relativeTime(n.timestamp)}
                            </span>
                          </div>
                          <p className="text-xs font-semibold text-gray-900 leading-snug">{n.title}</p>
                          <p className="text-xs text-gray-500 mt-0.5 line-clamp-2 leading-snug">{n.body}</p>
                        </div>
                        {/* Per-notification dismiss */}
                        <button
                          onClick={() => dismissOne(n.id)}
                          aria-label={`Dismiss notification: ${n.title}`}
                          className="self-start mt-0.5 p-0.5 rounded text-gray-300 hover:text-gray-500 transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <XMarkIcon className="size-3.5" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </PopoverContent>
          </Popover>

          {/* Profile → dashboard */}
          <Link
            href="/dashboard"
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-500"
            aria-label="Go to dashboard"
          >
            <UserCircleIcon className="w-6 h-6" />
          </Link>
        </div>
      </nav>

      <NavSidebar show={showNav} onClose={() => setShowNav(false)} />
    </>
  );
}
