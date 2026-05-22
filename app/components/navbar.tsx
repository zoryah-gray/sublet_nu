'use client';

import Link from 'next/link';
import { Bars3Icon, UserCircleIcon } from '@heroicons/react/24/outline';

interface NavBarProps {
  onMenuClick?: () => void;
}

export default function NavBar({ onMenuClick }: NavBarProps) {
  return (
    <nav className="h-15 bg-white border-b border-gray-200 flex items-center justify-between px-4 shrink-0">
      <button
        onClick={onMenuClick}
        className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-600"
        aria-label="Toggle filters"
      >
        <Bars3Icon className="w-5 h-5" />
      </button>

      <Link
        href="/"
        className="text-xl font-bold text-indigo-600 tracking-tight hover:text-indigo-700 transition-colors"
      >
        SubletNU
      </Link>

      <button
        className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-500"
        aria-label="User account"
      >
        <UserCircleIcon className="w-6 h-6" />
      </button>
    </nav>
  );
}
