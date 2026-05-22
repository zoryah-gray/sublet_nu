'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import {
  HomeIcon,
  MagnifyingGlassIcon,
  Squares2X2Icon,
  HeartIcon,
  XMarkIcon,
  ChatBubbleLeftEllipsisIcon as ChatBubbleOutline,
} from '@heroicons/react/24/outline';
import {
  HomeIcon as HomeSolid,
  MagnifyingGlassIcon as MagnifyingGlassSolid,
  Squares2X2Icon as Squares2X2Solid,
  HeartIcon as HeartSolid,
  ChatBubbleLeftEllipsisIcon as ChatBubbleSolid,
} from '@heroicons/react/24/solid';

const NAV_LINKS = [
  { name: 'Home', href: '/', Outline: HomeIcon, Solid: HomeSolid },
  { name: 'Browse', href: '/browse', Outline: MagnifyingGlassIcon, Solid: MagnifyingGlassSolid },
  { name: 'Dashboard', href: '/dashboard', Outline: Squares2X2Icon, Solid: Squares2X2Solid },
  { name: 'Favorites', href: '/favorites', Outline: HeartIcon, Solid: HeartSolid },
  { name: 'Messages', href: '/messages', Outline: ChatBubbleOutline, Solid: ChatBubbleSolid },
];

function isActive(href: string, pathname: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(href + '/');
}

export default function NavSidebar({
  show,
  onClose,
}: {
  show: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();

  return (
    <>
      {/* Backdrop */}
      <div
        className={clsx(
          'fixed inset-0 bg-black/20 z-40 transition-opacity duration-200',
          show ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        )}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        className={clsx(
          'fixed top-0 left-0 h-full w-64 bg-white z-50 shadow-xl border-r border-gray-200',
          'flex flex-col transition-transform duration-200',
          show ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Header */}
        <div className="h-15 flex items-center justify-between px-4 border-b border-gray-100 shrink-0">
          <span className="text-base font-bold text-violet-800 tracking-tight">SubletNU</span>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600"
            aria-label="Close menu"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Links */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {NAV_LINKS.map(({ name, href, Outline, Solid }) => {
            const active = isActive(href, pathname);
            const Icon = active ? Solid : Outline;
            return (
              <Link
                key={name}
                href={href}
                onClick={onClose}
                className={clsx(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors',
                  active
                    ? 'bg-violet-50 text-violet-900'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                )}
              >
                <Icon className="w-5 h-5 shrink-0" />
                <span className="flex-1">{name}</span>
                {active && <span className="w-1.5 h-1.5 rounded-full bg-violet-800 shrink-0" />}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-4 py-4 border-t border-gray-100 shrink-0">
          <p className="text-xs text-gray-400">SubletNU © 2026</p>
          <p className="text-xs text-gray-300 mt-0.5">Built for Wildcats.</p>
        </div>
      </div>
    </>
  );
}
