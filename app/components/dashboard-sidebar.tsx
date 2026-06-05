'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useLayoutEffect } from 'react';
import { cn } from '@/lib/utils';
import {
  UserCircleIcon,
  ListBulletIcon,
  HeartIcon,
  ChatBubbleLeftEllipsisIcon,
  Cog6ToothIcon,
  ArrowRightStartOnRectangleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';
import {
  UserCircleIcon as UserCircleSolid,
  ListBulletIcon as ListBulletSolid,
  HeartIcon as HeartSolid,
  ChatBubbleLeftEllipsisIcon as ChatBubbleSolid,
  Cog6ToothIcon as CogSolid,
} from '@heroicons/react/24/solid';
import { Separator } from '@/components/ui/separator';

const NAV_LINKS = [
  { name: 'Profile',      href: '/dashboard',  Outline: UserCircleIcon, Solid: UserCircleSolid },
  { name: 'My Listings',  href: '/listings', Outline: ListBulletIcon, Solid: ListBulletSolid },
  { name: 'Favorites',    href: '/favorites', Outline: HeartIcon, Solid: HeartSolid },
  { name: 'Messages',     href: '/messages',   Outline: ChatBubbleLeftEllipsisIcon, Solid: ChatBubbleSolid },
  { name: 'Settings',     href: '/dashboard/settings', Outline: Cog6ToothIcon, Solid: CogSolid },
];

function isActive(href: string, pathname: string): boolean {
  if (href === '/dashboard') return pathname === '/dashboard';
  return pathname === href || pathname.startsWith(href + '/');
}

export default function DashboardSidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  useLayoutEffect(() => {
    const mql = window.matchMedia('(max-width: 1023px)');
    const handler = (e: MediaQueryList | MediaQueryListEvent) => setCollapsed(e.matches);
    mql.addEventListener('change', handler as (e: MediaQueryListEvent) => void);
    handler(mql);
    return () => mql.removeEventListener('change', handler as (e: MediaQueryListEvent) => void);
  }, []);

  return (
    <aside
      className={cn(
        'h-full flex flex-col bg-white border-r border-gray-200 shrink-0 transition-all duration-200',
        collapsed ? 'w-14' : 'w-56'
      )}
    >
      {/* Collapse toggle */}
      <div className={cn('flex shrink-0', collapsed ? 'justify-center px-0 pt-3' : 'justify-end px-2 pt-3')}>
        <button
          onClick={() => setCollapsed((v) => !v)}
          className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? (
            <ChevronRightIcon className="w-4 h-4" />
          ) : (
            <ChevronLeftIcon className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Nav links */}
      <nav className="flex-1 px-2 py-2 space-y-0.5 overflow-y-auto">
        {NAV_LINKS.map(({ name, href, Outline, Solid }) => {
          const active = isActive(href, pathname);
          const Icon = active ? Solid : Outline;
          return (
            <Link
              key={name}
              href={href}
              className={cn(
                'flex items-center gap-3 px-2.5 py-2.5 rounded-xl text-sm font-medium transition-colors',
                collapsed ? 'justify-center' : '',
                active
                  ? 'bg-violet-50 text-violet-900'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              )}
              title={collapsed ? name : undefined}
            >
              <Icon className="w-5 h-5 shrink-0" />
              {!collapsed && <span className="flex-1 truncate">{name}</span>}
              {!collapsed && active && (
                <span className="w-1.5 h-1.5 rounded-full bg-violet-800 shrink-0" />
              )}
            </Link>
          );
        })}
      </nav>

      <Separator />

      {/* User footer */}
      <div className={cn('px-2 py-3 flex items-center gap-2.5', collapsed ? 'justify-center' : '')}>
        <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center shrink-0">
          <span className="text-xs font-bold text-violet-800">JD</span>
        </div>
        {!collapsed && (
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-gray-900 truncate">Jon Doe</p>
            <p className="text-[11px] text-gray-400 truncate">jonodono@gmail.com</p>
          </div>
        )}
        {!collapsed && (
          <button
            className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors shrink-0"
            aria-label="Sign out"
            title="Sign out"
          >
            <ArrowRightStartOnRectangleIcon className="w-4 h-4" />
          </button>
        )}
      </div>
    </aside>
  );
}
