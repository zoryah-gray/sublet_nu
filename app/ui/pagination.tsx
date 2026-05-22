'use client';

import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import clsx from 'clsx';

interface PaginationProps {
  page: number;
  total: number;
  perPage: number;
  onChange: (p: number) => void;
}

export default function Pagination({ page, total, perPage, onChange }: PaginationProps) {
  if (perPage <= 0) {
    console.error('Pagination: perPage must be greater than 0, got', perPage);
    return null;
  }
  if (total < 0) {
    console.error('Pagination: total must be >= 0, got', total);
    return null;
  }

  const totalPages = Math.max(1, Math.ceil(total / perPage));
  if (totalPages <= 1) return null;

  // Clamp page to valid range so stale state never causes a broken render
  const safePage = Math.max(1, Math.min(page, totalPages));

  const pages: (number | '…')[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (safePage > 3) pages.push('…');
    for (
      let i = Math.max(2, safePage - 1);
      i <= Math.min(totalPages - 1, safePage + 1);
      i++
    ) {
      pages.push(i);
    }
    if (safePage < totalPages - 2) pages.push('…');
    pages.push(totalPages);
  }

  const handleChange = (p: number) => {
    const clamped = Math.max(1, Math.min(p, totalPages));
    if (clamped !== safePage) onChange(clamped);
  };

  return (
    <div className="flex items-center justify-center gap-1 pt-6 pb-2">
      <button
        onClick={() => handleChange(safePage - 1)}
        disabled={safePage === 1}
        className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-30 disabled:pointer-events-none transition-colors"
        aria-label="Previous page"
      >
        <ChevronLeftIcon className="w-4 h-4" />
      </button>

      {pages.map((p, i) =>
        p === '…' ? (
          <span key={`ellipsis-${i}`} className="w-8 text-center text-xs text-gray-400">
            …
          </span>
        ) : (
          <button
            key={p}
            onClick={() => handleChange(p as number)}
            className={clsx(
              'w-8 h-8 rounded-lg text-xs font-medium transition-colors',
              safePage === p ? 'bg-violet-800 text-white' : 'text-gray-600 hover:bg-gray-100'
            )}
            aria-current={safePage === p ? 'page' : undefined}
          >
            {p}
          </button>
        )
      )}

      <button
        onClick={() => handleChange(safePage + 1)}
        disabled={safePage === totalPages}
        className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-30 disabled:pointer-events-none transition-colors"
        aria-label="Next page"
      >
        <ChevronRightIcon className="w-4 h-4" />
      </button>
    </div>
  );
}
