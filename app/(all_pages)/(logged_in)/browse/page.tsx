// Server component — no 'use client'.
// Reads searchParams, filters and paginates server-side, then passes the
// resulting card grid to BrowseFiltersClient as children.  The client island
// handles all interactivity and re-renders this page by pushing new URL params.
import { Suspense } from 'react';
import { MapPinIcon } from '@heroicons/react/24/outline';
import SubletCard from '@/app/components/sublet/sublet-card';
import BrowseFiltersClient, { MAX_PRICE } from './browse-filters-client';
import type { UrlFilters } from './browse-filters-client';
import {
  ITEMS_PER_PAGE,
  getFilteredSublets,
  type Quarter,
  type SortOrder,
} from '@/app/lib/mock-data';

// ─── Map placeholder (static, server-rendered) ────────────────────────────────

function MapPlaceholder({ count }: { count: number }) {
  return (
    <div className="w-full h-full bg-slate-100 relative overflow-hidden flex items-center justify-center">
      <div className="absolute inset-0 opacity-25">
        {Array.from({ length: 12 }).map((_, row) => (
          <div key={row} className="flex">
            {Array.from({ length: 8 }).map((_, col) => (
              <div key={col} className="border border-slate-300 bg-slate-50" style={{ width: 64, height: 64 }} />
            ))}
          </div>
        ))}
      </div>
      <div className="absolute inset-0 opacity-30 pointer-events-none">
        <div className="absolute top-1/4 left-0 right-0 h-0.5 bg-slate-300" />
        <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-slate-400" />
        <div className="absolute top-3/4 left-0 right-0 h-0.5 bg-slate-300" />
        <div className="absolute left-1/4 top-0 bottom-0 w-0.5 bg-slate-300" />
        <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-slate-400" />
        <div className="absolute left-3/4 top-0 bottom-0 w-0.5 bg-slate-300" />
      </div>
      <div className="relative z-10 flex flex-col items-center">
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 px-4 py-3 mb-3 text-center">
          <p className="text-sm font-semibold text-gray-800">Evanston, IL</p>
          <p className="text-xs text-violet-800 font-medium mt-0.5">
            {count} listing{count !== 1 ? 's' : ''} found
          </p>
        </div>
        <div className="w-8 h-8 bg-violet-800 rounded-full border-2 border-white shadow-md flex items-center justify-center">
          <MapPinIcon className="size-4 text-white" />
        </div>
        <div className="w-3 h-1.5 bg-violet-500/40 rounded-full mt-0.5 scale-x-150" />
        <div className="absolute -top-16 -left-20 w-5 h-5 bg-violet-500 rounded-full border-2 border-white shadow opacity-80" />
        <div className="absolute -top-8 left-16 w-5 h-5 bg-violet-600 rounded-full border-2 border-white shadow opacity-80" />
        <div className="absolute top-8 -left-24 w-4 h-4 bg-violet-400 rounded-full border-2 border-white shadow opacity-70" />
        <div className="absolute -top-20 left-4 w-4 h-4 bg-violet-500 rounded-full border-2 border-white shadow opacity-70" />
      </div>
    </div>
  );
}

// ─── Param parsing ────────────────────────────────────────────────────────────

function parseFilters(p: Record<string, string | string[] | undefined>): UrlFilters {
  const raw = (k: string) => (typeof p[k] === 'string' ? (p[k] as string) : undefined);

  const quarters = raw('quarters')
    ?.split(',')
    .map((s) => s.trim())
    .filter((s): s is Quarter => ['Fall', 'Winter', 'Spring', 'Summer'].includes(s)) ?? [];

  return {
    query:     raw('q')    ?? '',
    minPrice:  Math.max(0,        Number(raw('minPrice') ?? 0)         || 0),
    maxPrice:  Math.min(MAX_PRICE, Number(raw('maxPrice') ?? MAX_PRICE) || MAX_PRICE),
    sortOrder: (['asc', 'desc', 'new'].includes(raw('sort') ?? '') ? raw('sort') as SortOrder : 'new'),
    quarters,
  };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function BrowsePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params  = await searchParams;
  const filters = parseFilters(params);
  const page    = Math.max(1, Number(typeof params.page === 'string' ? params.page : '1') || 1);

  const filtered    = getFilteredSublets({
    query:     filters.query     || undefined,
    quarters:  filters.quarters.length ? filters.quarters : undefined,
    minPrice:  filters.minPrice  > 0        ? filters.minPrice  : undefined,
    maxPrice:  filters.maxPrice  < MAX_PRICE ? filters.maxPrice  : undefined,
    sortOrder: filters.sortOrder !== 'new'   ? filters.sortOrder : undefined,
  });

  const pageSublets = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  // The card grid is server-rendered and passed as children to the client
  // island.  React preserves this HTML on the client; only BrowseFiltersClient
  // itself is hydrated.
  const cardGrid = (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
      {pageSublets.map((sublet) => (
        <SubletCard key={sublet.id} sublet={sublet} />
      ))}
    </div>
  );

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* useSearchParams inside BrowseFiltersClient requires Suspense so the
          static shell (map aside) can pre-render without waiting for params. */}
      <Suspense fallback={<div className="flex-1 animate-pulse bg-gray-50" />}>
        <BrowseFiltersClient
          currentFilters={filters}
          totalCount={filtered.length}
          currentPage={page}
        >
          {cardGrid}
        </BrowseFiltersClient>
      </Suspense>

      {/* Static aside — pre-rendered on the server, no JS needed */}
      <aside className="hidden lg:block w-80 xl:w-96 shrink-0 border-l border-gray-200">
        <MapPlaceholder count={filtered.length} />
      </aside>
    </div>
  );
}
