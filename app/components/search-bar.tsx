'use client';

import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { cn } from '@/lib/utils';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export default function SearchBar({
  value,
  onChange,
  placeholder = 'Search…',
  className,
}: SearchBarProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 h-9',
        'focus-within:border-violet-500 focus-within:bg-white transition-colors',
        className
      )}
    >
      <MagnifyingGlassIcon className="size-4 text-gray-400 shrink-0" />
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 bg-transparent text-sm text-gray-800 placeholder-gray-400 outline-none cursor-text"
      />
      {value && (
        <button
          onClick={() => onChange('')}
          aria-label="Clear search"
          className="text-gray-400 hover:text-gray-600 transition-colors"
        >
          <XMarkIcon className="size-4" />
        </button>
      )}
    </div>
  );
}
