'use client';

import { useState, useMemo } from 'react';
import clsx from 'clsx';
import {
  MagnifyingGlassIcon,
  MapPinIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  FunnelIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import NavBar from '@/app/components/navbar';
import SubletCard from '@/app/ui/sublet-card';
import {
  MOCK_SUBLETS,
  ITEMS_PER_PAGE,
  getFilteredSublets,
  type Season,
  type SortOrder,
} from '@/app/lib/mock-data';

// ─── Types ────────────────────────────────────────────────────────────────────

type FilterState = {
  query: string;
  minPrice: number;
  maxPrice: number;
  sortOrder: SortOrder;
  seasons: Season[];
};

const ALL_SEASONS: Season[] = ['Fall', 'Winter', 'Spring', 'Summer'];
const SEASON_COLORS: Record<Season, { on: string; off: string }> = {
  Fall: { on: 'bg-amber-500 text-white border-amber-500', off: 'border-amber-200 text-amber-700 hover:bg-amber-50' },
  Winter: { on: 'bg-sky-500 text-white border-sky-500', off: 'border-sky-200 text-sky-700 hover:bg-sky-50' },
  Spring: { on: 'bg-green-500 text-white border-green-500', off: 'border-green-200 text-green-700 hover:bg-green-50' },
  Summer: { on: 'bg-orange-500 text-white border-orange-500', off: 'border-orange-200 text-orange-700 hover:bg-orange-50' },
};

const MAX_PRICE = 5000;

// ─── Map Placeholder ──────────────────────────────────────────────────────────

function MapPlaceholder({ count }: { count: number }) {
  return (
    <div className="w-full h-full bg-slate-100 relative overflow-hidden flex items-center justify-center">
      {/* Tile grid */}
      <div className="absolute inset-0 opacity-25">
        {Array.from({ length: 12 }).map((_, row) => (
          <div key={row} className="flex">
            {Array.from({ length: 8 }).map((_, col) => (
              <div
                key={col}
                className="border border-slate-300 bg-slate-50"
                style={{ width: 64, height: 64 }}
              />
            ))}
          </div>
        ))}
      </div>
      {/* Roads */}
      <div className="absolute inset-0 opacity-30 pointer-events-none">
        <div className="absolute top-1/4 left-0 right-0 h-0.5 bg-slate-300" />
        <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-slate-400" />
        <div className="absolute top-3/4 left-0 right-0 h-0.5 bg-slate-300" />
        <div className="absolute left-1/4 top-0 bottom-0 w-0.5 bg-slate-300" />
        <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-slate-400" />
        <div className="absolute left-3/4 top-0 bottom-0 w-0.5 bg-slate-300" />
      </div>
      {/* Pin cluster */}
      <div className="relative z-10 flex flex-col items-center">
        {/* Popup card */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 px-4 py-3 mb-3 text-center">
          <p className="text-sm font-semibold text-gray-800">Evanston, IL</p>
          <p className="text-xs text-indigo-600 font-medium mt-0.5">
            {count} listing{count !== 1 ? 's' : ''} found
          </p>
        </div>
        {/* Pin */}
        <div className="w-8 h-8 bg-indigo-600 rounded-full border-2 border-white shadow-md flex items-center justify-center">
          <MapPinIcon className="w-4 h-4 text-white" />
        </div>
        <div className="w-3 h-1.5 bg-indigo-400/40 rounded-full mt-0.5 scale-x-150" />
        {/* Scatter pins */}
        <div className="absolute -top-16 -left-20 w-5 h-5 bg-indigo-400 rounded-full border-2 border-white shadow opacity-80" />
        <div className="absolute -top-8 left-16 w-5 h-5 bg-indigo-500 rounded-full border-2 border-white shadow opacity-80" />
        <div className="absolute top-8 -left-24 w-4 h-4 bg-indigo-300 rounded-full border-2 border-white shadow opacity-70" />
        <div className="absolute -top-20 left-4 w-4 h-4 bg-indigo-400 rounded-full border-2 border-white shadow opacity-70" />
      </div>
    </div>
  );
}

// ─── Filter Sidebar ───────────────────────────────────────────────────────────

function FilterSidebar({
  filters,
  onChange,
}: {
  filters: FilterState;
  onChange: (f: Partial<FilterState>) => void;
}) {
  const toggleSeason = (s: Season) => {
    const next = filters.seasons.includes(s)
      ? filters.seasons.filter((x) => x !== s)
      : [...filters.seasons, s];
    onChange({ seasons: next });
  };

  return (
    <div className="h-full overflow-y-auto px-4 py-5 space-y-6">
      <p className="text-base font-bold text-gray-900">Filters</p>

      {/* Price range */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-700">Price</p>
          <span className="text-xs text-gray-400 font-medium">
            ${filters.minPrice.toLocaleString()} – ${filters.maxPrice === MAX_PRICE ? '5,000+' : filters.maxPrice.toLocaleString()}
          </span>
        </div>
        <p className="text-xs text-gray-400">Per month</p>
        <div className="space-y-2">
          <label className="text-xs text-gray-500 flex justify-between">
            <span>Min</span>
            <span className="font-medium text-gray-700">${filters.minPrice.toLocaleString()}</span>
          </label>
          <input
            type="range"
            min={0}
            max={MAX_PRICE}
            step={50}
            value={filters.minPrice}
            onChange={(e) => onChange({ minPrice: Number(e.target.value) })}
            className="w-full accent-indigo-600"
          />
          <label className="text-xs text-gray-500 flex justify-between">
            <span>Max</span>
            <span className="font-medium text-gray-700">
              {filters.maxPrice >= MAX_PRICE ? '$5,000+' : `$${filters.maxPrice.toLocaleString()}`}
            </span>
          </label>
          <input
            type="range"
            min={0}
            max={MAX_PRICE}
            step={50}
            value={filters.maxPrice}
            onChange={(e) => onChange({ maxPrice: Number(e.target.value) })}
            className="w-full accent-indigo-600"
          />
        </div>

        {/* Sort */}
        <div className="pt-1 space-y-1.5">
          <p className="text-xs text-gray-400">Sort by price</p>
          <div className="flex gap-2">
            <button
              onClick={() =>
                onChange({ sortOrder: filters.sortOrder === 'desc' ? 'new' : 'desc' })
              }
              className={clsx(
                'flex-1 text-xs py-1.5 rounded-lg border font-medium transition-colors',
                filters.sortOrder === 'desc'
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'border-gray-200 text-gray-600 hover:bg-gray-50'
              )}
            >
              Descending ↓
            </button>
            <button
              onClick={() =>
                onChange({ sortOrder: filters.sortOrder === 'asc' ? 'new' : 'asc' })
              }
              className={clsx(
                'flex-1 text-xs py-1.5 rounded-lg border font-medium transition-colors',
                filters.sortOrder === 'asc'
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'border-gray-200 text-gray-600 hover:bg-gray-50'
              )}
            >
              Ascending ↑
            </button>
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-gray-100" />

      {/* Duration / Season */}
      <div className="space-y-3">
        <p className="text-sm font-semibold text-gray-700">Duration</p>
        <div className="flex flex-wrap gap-2">
          {ALL_SEASONS.map((season) => {
            const active = filters.seasons.includes(season);
            return (
              <button
                key={season}
                onClick={() => toggleSeason(season)}
                className={clsx(
                  'text-xs px-3 py-1.5 rounded-full border font-medium transition-colors',
                  active ? SEASON_COLORS[season].on : SEASON_COLORS[season].off
                )}
              >
                {season}
              </button>
            );
          })}
        </div>
        {filters.seasons.length > 0 && (
          <button
            onClick={() => onChange({ seasons: [] })}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            Clear seasons
          </button>
        )}
      </div>

      {/* Divider */}
      <div className="border-t border-gray-100" />

      {/* Reset all */}
      <button
        onClick={() =>
          onChange({
            minPrice: 0,
            maxPrice: MAX_PRICE,
            sortOrder: 'new',
            seasons: [],
            query: '',
          })
        }
        className="w-full text-xs py-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors"
      >
        Reset all filters
      </button>
    </div>
  );
}

// ─── Pagination ───────────────────────────────────────────────────────────────

function Pagination({
  page,
  total,
  perPage,
  onChange,
}: {
  page: number;
  total: number;
  perPage: number;
  onChange: (p: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  if (totalPages <= 1) return null;

  const pages: (number | '…')[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (page > 3) pages.push('…');
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) {
      pages.push(i);
    }
    if (page < totalPages - 2) pages.push('…');
    pages.push(totalPages);
  }

  return (
    <div className="flex items-center justify-center gap-1 pt-6 pb-2">
      <button
        onClick={() => onChange(page - 1)}
        disabled={page === 1}
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
            onClick={() => onChange(p as number)}
            className={clsx(
              'w-8 h-8 rounded-lg text-xs font-medium transition-colors',
              page === p
                ? 'bg-indigo-600 text-white'
                : 'text-gray-600 hover:bg-gray-100'
            )}
          >
            {p}
          </button>
        )
      )}

      <button
        onClick={() => onChange(page + 1)}
        disabled={page === totalPages}
        className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-30 disabled:pointer-events-none transition-colors"
        aria-label="Next page"
      >
        <ChevronRightIcon className="w-4 h-4" />
      </button>
    </div>
  );
}

// ─── Browse Page ──────────────────────────────────────────────────────────────

const DEFAULT_FILTERS: FilterState = {
  query: '',
  minPrice: 0,
  maxPrice: MAX_PRICE,
  sortOrder: 'new',
  seasons: [],
};

export default function BrowsePage() {
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);

  const updateFilters = (partial: Partial<FilterState>) => {
    setFilters((f) => ({ ...f, ...partial }));
    setPage(1);
  };

  const filtered = useMemo(
    () =>
      getFilteredSublets({
        query: filters.query,
        minPrice: filters.minPrice > 0 ? filters.minPrice : undefined,
        maxPrice: filters.maxPrice < MAX_PRICE ? filters.maxPrice : undefined,
        sortOrder: filters.sortOrder,
        seasons: filters.seasons.length > 0 ? filters.seasons : undefined,
      }),
    [filters]
  );

  const pageSublets = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const hasActiveFilters =
    filters.query !== '' ||
    filters.minPrice > 0 ||
    filters.maxPrice < MAX_PRICE ||
    filters.sortOrder !== 'new' ||
    filters.seasons.length > 0;

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-white">
      {/* Navbar */}
      <NavBar onMenuClick={() => setShowFilters((v) => !v)} />

      {/* Body */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* ── Filter sidebar ── */}
        <aside
          className={clsx(
            'absolute inset-y-0 left-0 z-20 w-72 bg-white border-r border-gray-200 transition-transform duration-200 shrink-0',
            showFilters ? 'translate-x-0 shadow-xl' : '-translate-x-full'
          )}
        >
          <FilterSidebar filters={filters} onChange={updateFilters} />
        </aside>

        {/* Backdrop */}
        {showFilters && (
          <div
            className="fixed inset-0 bg-black/20 z-10"
            onClick={() => setShowFilters(false)}
          />
        )}

        {/* ── Main content ── */}
        <main className="flex-1 overflow-y-auto flex flex-col">
          {/* Search + active filters bar */}
          <div className="px-4 pt-4 pb-3 border-b border-gray-100 space-y-2 shrink-0">
            <div className="flex items-center gap-2">
              {/* Filter toggle */}
              <button
                onClick={() => setShowFilters((v) => !v)}
                className={clsx(
                  'flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm font-medium shrink-0 transition-colors',
                  showFilters || hasActiveFilters
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                )}
              >
                <FunnelIcon className="w-4 h-4" />
                Filters
                {hasActiveFilters && (
                  <span className="ml-0.5 w-4 h-4 rounded-full bg-white/30 text-xs flex items-center justify-center font-bold">
                    !
                  </span>
                )}
              </button>

              {/* Search input */}
              <div className="flex-1 flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 h-10 focus-within:border-indigo-400 focus-within:bg-white transition-colors">
                <MagnifyingGlassIcon className="w-4 h-4 text-gray-400 shrink-0" />
                <input
                  type="text"
                  placeholder="Search by title, address, or neighborhood…"
                  value={filters.query}
                  onChange={(e) => updateFilters({ query: e.target.value })}
                  className="flex-1 bg-transparent text-sm text-gray-800 placeholder-gray-400 outline-none"
                />
                {filters.query && (
                  <button
                    onClick={() => updateFilters({ query: '' })}
                    className="text-gray-400 hover:text-gray-600"
                    aria-label="Clear search"
                  >
                    <XMarkIcon className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Active filter chips */}
            {hasActiveFilters && (
              <div className="flex flex-wrap gap-1.5 items-center">
                <span className="text-xs text-gray-400">Active:</span>
                {filters.sortOrder !== 'new' && (
                  <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-medium">
                    Price {filters.sortOrder === 'asc' ? '↑' : '↓'}
                    <button onClick={() => updateFilters({ sortOrder: 'new' })}>
                      <XMarkIcon className="w-3 h-3" />
                    </button>
                  </span>
                )}
                {filters.seasons.map((s) => (
                  <span
                    key={s}
                    className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-medium"
                  >
                    {s}
                    <button
                      onClick={() =>
                        updateFilters({ seasons: filters.seasons.filter((x) => x !== s) })
                      }
                    >
                      <XMarkIcon className="w-3 h-3" />
                    </button>
                  </span>
                ))}
                {(filters.minPrice > 0 || filters.maxPrice < MAX_PRICE) && (
                  <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-medium">
                    ${filters.minPrice.toLocaleString()}–
                    {filters.maxPrice >= MAX_PRICE ? '5k+' : `$${filters.maxPrice.toLocaleString()}`}
                    <button onClick={() => updateFilters({ minPrice: 0, maxPrice: MAX_PRICE })}>
                      <XMarkIcon className="w-3 h-3" />
                    </button>
                  </span>
                )}
                <button
                  onClick={() => {
                    setFilters(DEFAULT_FILTERS);
                    setPage(1);
                  }}
                  className="text-xs text-gray-400 hover:text-red-500 transition-colors ml-1"
                >
                  Clear all
                </button>
              </div>
            )}
          </div>

          {/* Results count */}
          <div className="px-4 pt-3 pb-1 shrink-0">
            <p className="text-xs text-gray-400">
              {filtered.length === 0
                ? 'No listings found'
                : `${filtered.length} listing${filtered.length !== 1 ? 's' : ''} found`}
            </p>
          </div>

          {/* Card grid */}
          <div className="flex-1 px-4 pb-2">
            {pageSublets.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
                  <MagnifyingGlassIcon className="w-8 h-8 text-gray-300" />
                </div>
                <p className="text-gray-500 font-medium">No listings match your filters</p>
                <p className="text-gray-400 text-sm mt-1">Try adjusting your search or filters</p>
                <button
                  onClick={() => { setFilters(DEFAULT_FILTERS); setPage(1); }}
                  className="mt-4 text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                >
                  Clear all filters
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {pageSublets.map((sublet) => (
                  <SubletCard key={sublet.id} sublet={sublet} />
                ))}
              </div>
            )}
          </div>

          {/* Pagination */}
          <div className="px-4 shrink-0">
            <Pagination
              page={page}
              total={filtered.length}
              perPage={ITEMS_PER_PAGE}
              onChange={(p) => { setPage(p); window.scrollTo({ top: 0 }); }}
            />
          </div>
        </main>

        {/* ── Map ── */}
        <aside className="hidden lg:block w-80 xl:w-96 shrink-0 border-l border-gray-200">
          <MapPlaceholder count={filtered.length} />
        </aside>
      </div>
    </div>
  );
}
