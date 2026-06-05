'use client';

// All browse interactivity lives here so the page shell and card grid can be
// server-rendered. The card grid is passed as `children` from the server page;
// React preserves the server-rendered HTML and only hydrates this island.

import { useState, useEffect, useCallback, useTransition, useRef } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { format } from 'date-fns';
import type { DateRange } from 'react-day-picker';
import {
  FunnelIcon,
  XMarkIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';
import { CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import SearchBar from '@/app/components/search-bar';
import Pagination from '@/app/components/pagination';
import { cn } from '@/lib/utils';
import {
  MOCK_SUBLETS,
  ITEMS_PER_PAGE,
  type Quarter,
  type SortOrder,
} from '@/app/lib/mock-data';

// ─── Types ────────────────────────────────────────────────────────────────────

type PlaceType = 'entire' | 'private';

// Filters serialised in the URL (drive server-side filtering).
export interface UrlFilters {
  query: string;
  quarters: Quarter[];
  minPrice: number;
  maxPrice: number;
  sortOrder: SortOrder;
}

// ─── Constants ────────────────────────────────────────────────────────────────

export const MAX_PRICE = 5000;
const ALL_QUARTERS: Quarter[] = ['Fall', 'Winter', 'Spring', 'Summer'];
const BUCKET_COUNT = 20;
const BUCKET_WIDTH = MAX_PRICE / BUCKET_COUNT;

const QUARTER_COLORS: Record<Quarter, { on: string; off: string }> = {
  Fall:   { on: 'bg-amber-500 text-white border-amber-500',   off: 'border-amber-200 text-amber-700 hover:bg-amber-50' },
  Winter: { on: 'bg-sky-500 text-white border-sky-500',       off: 'border-sky-200 text-sky-700 hover:bg-sky-50' },
  Spring: { on: 'bg-green-500 text-white border-green-500',   off: 'border-green-200 text-green-700 hover:bg-green-50' },
  Summer: { on: 'bg-orange-500 text-white border-orange-500', off: 'border-orange-200 text-orange-700 hover:bg-orange-50' },
};

const PLACE_TYPES: { value: PlaceType; label: string; description: string }[] = [
  { value: 'entire',  label: 'Entire place',  description: 'A place all to yourself' },
  { value: 'private', label: 'Private room',  description: 'Your own room, plus some shared common spaces' },
];

// Pre-computed price histogram from all listings (static, no client state needed).
const PRICE_BUCKETS = (() => {
  const buckets = new Array<number>(BUCKET_COUNT).fill(0);
  for (const s of MOCK_SUBLETS) {
    buckets[Math.min(Math.floor(s.price / BUCKET_WIDTH), BUCKET_COUNT - 1)]++;
  }
  return buckets;
})();
const BUCKET_MAX = Math.max(...PRICE_BUCKETS, 1);

// ─── URL helpers ──────────────────────────────────────────────────────────────

function buildUrl(
  pathname: string,
  current: URLSearchParams,
  updates: Partial<Record<string, string | undefined>>,
): string {
  const p = new URLSearchParams(current);
  for (const [k, v] of Object.entries(updates)) {
    if (v === undefined || v === '') p.delete(k);
    else p.set(k, v);
  }
  // Reset to page 1 on filter changes, but not when explicitly navigating to a page.
  if (!('page' in updates)) p.delete('page');
  const qs = p.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function PriceHistogram({ minPrice, maxPrice }: { minPrice: number; maxPrice: number }) {
  return (
    <div className="flex items-end gap-0.5 h-10 pointer-events-none" aria-hidden>
      {PRICE_BUCKETS.map((count, i) => {
        const mid = (i + 0.5) * BUCKET_WIDTH;
        return (
          <div
            key={i}
            className={cn('flex-1 rounded-t-xs transition-colors duration-150', mid >= minPrice && mid <= maxPrice ? 'bg-primary/40' : 'bg-gray-200')}
            style={{ height: count > 0 ? `${(count / BUCKET_MAX) * 100}%` : 0, minHeight: count > 0 ? 2 : 0 }}
          />
        );
      })}
    </div>
  );
}

function PriceInput({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  // While focused: show `draft` so the user can type freely.
  // While blurred: show prop `value` so slider moves and resets are reflected.
  const [focused, setFocused] = useState(false);
  const [draft,   setDraft]   = useState('');

  const commit = (raw: string) => {
    const n = parseInt(raw.replace(/[^0-9]/g, ''), 10);
    onChange(isNaN(n) ? value : Math.max(min, Math.min(max, n)));
  };

  return (
    <div className="flex-1 rounded-xl border border-gray-200 px-3 py-2">
      <p className="text-xs text-gray-400">{label}</p>
      <div className="flex items-center gap-0.5 mt-0.5">
        <span className="text-sm font-medium text-gray-900">$</span>
        <input
          className="w-0 flex-1 text-sm font-medium text-gray-900 bg-transparent outline-none cursor-text"
          value={focused ? draft : String(value)}
          onChange={(e) => setDraft(e.target.value)}
          onFocus={() => { setFocused(true); setDraft(String(value)); }}
          onBlur={() => { setFocused(false); commit(draft); }}
          onKeyDown={(e) => { if (e.key === 'Enter') { commit(draft); (e.target as HTMLInputElement).blur(); } }}
        />
      </div>
    </div>
  );
}

// ─── Filter sidebar panel ─────────────────────────────────────────────────────

function FilterSidebar({
  filters,
  dateRange,
  placeType,
  onUrlChange,
  onDateChange,
  onPlaceChange,
  onClose,
}: {
  filters: UrlFilters;
  dateRange: DateRange | undefined;
  placeType: PlaceType | undefined;
  onUrlChange: (updates: Partial<Record<string, string | undefined>>) => void;
  onDateChange: (r: DateRange | undefined) => void;
  onPlaceChange: (p: PlaceType | undefined) => void;
  onClose: () => void;
}) {
  const [calendarOpen, setCalendarOpen] = useState(false);

  const toggleSeason = (s: Quarter) => {
    const next = filters.quarters.includes(s)
      ? filters.quarters.filter((x) => x !== s)
      : [...filters.quarters, s];
    onUrlChange({ quarters: next.length ? next.join(',') : undefined });
  };

  const reset = () => {
    onUrlChange({ q: undefined, quarters: undefined, minPrice: undefined, maxPrice: undefined, sort: undefined });
    onDateChange(undefined);
    onPlaceChange(undefined);
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex-none px-4 pt-5 pb-3 bg-background">
        <div className="flex justify-between">
          <p className="text-2xl font-bold text-gray-900">Filters</p>
          <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close filters" className="text-gray-400 hover:text-gray-600">
            <XMarkIcon className="size-5" />
          </Button>
        </div>
        <Separator className="mt-3" />
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-5 space-y-6">

        {/* Price */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Price Range</h2>
            <button onClick={() => onUrlChange({ minPrice: undefined, maxPrice: undefined })} className="text-xs text-gray-400 hover:text-gray-600 transition-colors">Reset</button>
          </div>
          <PriceHistogram minPrice={filters.minPrice} maxPrice={filters.maxPrice} />
          <Slider
            min={0} max={MAX_PRICE} step={50}
            value={[filters.minPrice, filters.maxPrice]}
            onValueChange={([lo, hi]) => onUrlChange({ minPrice: lo > 0 ? String(lo) : undefined, maxPrice: hi < MAX_PRICE ? String(hi) : undefined })}
          />
          <div className="flex gap-2 pt-1">
            <PriceInput label="Min price" value={filters.minPrice} min={0} max={filters.maxPrice} onChange={(v) => onUrlChange({ minPrice: v > 0 ? String(v) : undefined })} />
            <PriceInput label="Max price" value={filters.maxPrice} min={filters.minPrice} max={MAX_PRICE} onChange={(v) => onUrlChange({ maxPrice: v < MAX_PRICE ? String(v) : undefined })} />
          </div>
          <div className="pt-2 space-y-1.5">
            <p className="text-xs text-muted-foreground">Sort by price</p>
            <div className="flex gap-2">
              <Button variant={filters.sortOrder === 'desc' ? 'default' : 'outline'} size="xs" className="flex-1" onClick={() => onUrlChange({ sort: filters.sortOrder === 'desc' ? undefined : 'desc' })}>Descending ↓</Button>
              <Button variant={filters.sortOrder === 'asc'  ? 'default' : 'outline'} size="xs" className="flex-1" onClick={() => onUrlChange({ sort: filters.sortOrder === 'asc'  ? undefined : 'asc'  })}>Ascending ↑</Button>
            </div>
          </div>
        </div>

        <Separator />

        {/* Duration */}
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-gray-900">Duration</h2>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">Quarter Available</h3>
            {filters.quarters.length > 0 && (
              <button onClick={() => onUrlChange({ quarters: undefined })} className="text-xs text-gray-400 hover:text-gray-600 transition-colors">Reset</button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {ALL_QUARTERS.map((s) => {
              const active = filters.quarters.includes(s);
              return (
                <button key={s} onClick={() => toggleSeason(s)} className={cn('text-xs px-3 py-1.5 rounded-full border font-medium transition-colors', active ? QUARTER_COLORS[s].on : QUARTER_COLORS[s].off)}>{s}</button>
              );
            })}
          </div>

          {/* Date range (client-only state — not wired to filtering yet) */}
          <div className="space-y-1.5 mt-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">Dates Available</h3>
              {dateRange?.from && <button onClick={() => onDateChange(undefined)} className="text-xs text-gray-400 hover:text-gray-600 transition-colors">Reset</button>}
            </div>
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="w-full justify-start text-left font-normal">
                  <CalendarIcon className="size-3.5 text-muted-foreground shrink-0" />
                  {dateRange?.from ? (
                    <span className="text-xs">{format(dateRange.from, 'MMM d')} {' – '} {dateRange.to ? format(dateRange.to, 'MMM d, yyyy') : '…'}</span>
                  ) : (
                    <span className="text-xs text-muted-foreground">Pick a date range</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="range" selected={dateRange} onSelect={(r) => onDateChange(r ?? undefined)} numberOfMonths={1} />
                {dateRange?.from && (
                  <div className="border-t px-3 py-2">
                    <Button variant="ghost" size="xs" className="w-full text-xs text-muted-foreground" onClick={() => { onDateChange(undefined); setCalendarOpen(false); }}>Clear dates</Button>
                  </div>
                )}
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <Separator />

        {/* Type of place (client-only state — not wired to filtering yet) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Type of Place</h2>
            {placeType && <button onClick={() => onPlaceChange(undefined)} className="text-xs text-gray-400 hover:text-gray-600 transition-colors">Reset</button>}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-1 gap-2">
            {PLACE_TYPES.map((pt) => (
              <button
                key={pt.value}
                onClick={() => onPlaceChange(placeType === pt.value ? undefined : pt.value)}
                className={cn('flex flex-col items-start text-left p-3 rounded-xl transition-all', placeType === pt.value ? 'border-2 border-primary' : 'border border-gray-200 hover:border-border')}
              >
                <span className="text-sm font-semibold text-gray-900">{pt.label}</span>
                <span className="text-xs text-gray-500 mt-1 leading-relaxed">{pt.description}</span>
              </button>
            ))}
          </div>
        </div>

        <Separator className="mb-3" />

        <Button variant="outline" size="sm" className="w-full" onClick={reset}>Reset all filters</Button>
      </div>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

interface BrowseFiltersClientProps {
  /** Current filter values derived from URL params by the server page. */
  currentFilters: UrlFilters;
  /** Total matching listings (computed server-side). */
  totalCount: number;
  /** Current page number (1-based, computed server-side). */
  currentPage: number;
  /** Server-rendered card grid (or empty state) passed as children. */
  children: React.ReactNode;
}

export default function BrowseFiltersClient({
  currentFilters,
  totalCount,
  currentPage,
  children,
}: BrowseFiltersClientProps) {
  const router   = useRouter();
  const pathname = usePathname();
  const params   = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const mainRef  = useRef<HTMLElement>(null);

  // UI-only state (not serialised to URL)
  const [showFilters, setShowFilters] = useState(false);
  const [dateRange,   setDateRange]   = useState<DateRange | undefined>(undefined);
  const [placeType,   setPlaceType]   = useState<PlaceType | undefined>(undefined);

  // Local query for the search input so keystrokes don't trigger navigation on
  // every character. We debounce and then push to the URL.
  const [localQuery, setLocalQuery] = useState(currentFilters.query);

  // Keep localQuery in sync when the server sends new currentFilters (e.g. on
  // browser back/forward navigation).
  useEffect(() => {
    setLocalQuery(currentFilters.query);
  }, [currentFilters.query]);

  // Debounce: push query to URL 350 ms after the user stops typing.
  useEffect(() => {
    const t = setTimeout(() => {
      if (localQuery !== currentFilters.query) {
        push({ q: localQuery || undefined });
      }
    }, 350);
    return () => clearTimeout(t);
  // Only re-run when localQuery changes, NOT when currentFilters.query changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localQuery]);

  const push = useCallback(
    (updates: Partial<Record<string, string | undefined>>) => {
      startTransition(() => {
        router.push(buildUrl(pathname, params, updates));
      });
    },
    [router, pathname, params],
  );

  const clearAll = () => {
    setLocalQuery('');
    setDateRange(undefined);
    setPlaceType(undefined);
    startTransition(() => router.push(pathname));
  };

  // ── Active chips (URL-driven filters only) ──────────────────────────────────
  type Chip = { key: string; category: string; label: string; onRemove: () => void };
  const chips: Chip[] = [];

  if (currentFilters.sortOrder === 'asc')  chips.push({ key: 'sort', category: 'Sort', label: 'Price ↑', onRemove: () => push({ sort: undefined }) });
  if (currentFilters.sortOrder === 'desc') chips.push({ key: 'sort', category: 'Sort', label: 'Price ↓', onRemove: () => push({ sort: undefined }) });
  for (const s of currentFilters.quarters)
    chips.push({ key: `season-${s}`, category: 'Quarter', label: s, onRemove: () => push({ quarters: currentFilters.quarters.filter((x) => x !== s).join(',') || undefined }) });
  if (currentFilters.minPrice > 0 || currentFilters.maxPrice < MAX_PRICE) {
    const lo = `$${currentFilters.minPrice.toLocaleString()}`;
    const hi = currentFilters.maxPrice >= MAX_PRICE ? '5k+' : `$${currentFilters.maxPrice.toLocaleString()}`;
    chips.push({ key: 'price', category: 'Price', label: `${lo} – ${hi}`, onRemove: () => push({ minPrice: undefined, maxPrice: undefined }) });
  }
  if (currentFilters.query.trim())
    chips.push({ key: 'query', category: 'Search', label: `"${currentFilters.query}"`, onRemove: () => { setLocalQuery(''); push({ q: undefined }); } });
  if (dateRange?.from) {
    const from = format(dateRange.from, 'MMM d, yyyy');
    const to   = dateRange.to ? format(dateRange.to, 'MMM d, yyyy') : '…';
    chips.push({ key: 'date', category: 'Dates', label: `${from} – ${to}`, onRemove: () => setDateRange(undefined) });
  }
  if (placeType)
    chips.push({ key: 'place', category: 'Place', label: placeType === 'entire' ? 'Entire place' : 'Private room', onRemove: () => setPlaceType(undefined) });

  const hasChips = chips.length > 0;
  const filtersActive = hasChips || showFilters;

  // ── Pagination helpers ──────────────────────────────────────────────────────
  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);
  const goToPage = (p: number) => {
    startTransition(() => {
      router.push(buildUrl(pathname, params, { page: p > 1 ? String(p) : undefined }));
      mainRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    });
  };

  return (
    <div className="flex flex-1 overflow-hidden relative">

      {/* ── Slide-in filter sidebar ── */}
      <aside className={cn('absolute inset-y-0 left-0 z-20 w-72 bg-white border-r border-gray-200 transition-transform duration-200 shrink-0', showFilters ? 'translate-x-0 shadow-xl' : '-translate-x-full')}>
        <FilterSidebar
          filters={currentFilters}
          dateRange={dateRange}
          placeType={placeType}
          onUrlChange={push}
          onDateChange={setDateRange}
          onPlaceChange={setPlaceType}
          onClose={() => setShowFilters(false)}
        />
      </aside>
      {showFilters && <div className="fixed inset-0 bg-black/20 z-10" onClick={() => setShowFilters(false)} />}

      {/* ── Main column ── */}
      <main ref={mainRef} className={cn('flex-1 overflow-y-auto flex flex-col transition-opacity duration-150', isPending && 'opacity-60')}>

        {/* Top bar: filter toggle + search */}
        <div className="px-4 pt-4 pb-3 border-b border-gray-100 space-y-2 shrink-0">
          <div className="flex items-center gap-2">
            <Button
              variant={filtersActive ? 'default' : 'outline'}
              size="sm"
              onClick={() => setShowFilters((v) => !v)}
              className={cn('shrink-0', filtersActive && 'bg-violet-800 text-white border-violet-800 hover:bg-violet-900 hover:border-violet-900')}
            >
              <FunnelIcon className="size-4" />
              <span className="hidden sm:inline">Filters</span>
            </Button>
            <SearchBar
              className="flex-1"
              value={localQuery}
              onChange={setLocalQuery}
              placeholder="Search by title, address, or neighborhood…"
            />
          </div>

          {hasChips && (
            <div className="flex flex-wrap gap-1.5 items-center">
              {chips.map((chip) => (
                <span key={chip.key} className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-2.5 py-1 text-xs shadow-sm">
                  <span className="size-1.5 rounded-full bg-primary shrink-0" />
                  <span className="font-semibold text-gray-700">{chip.category}</span>
                  <span className="text-gray-500">{chip.label}</span>
                  <button onClick={chip.onRemove} aria-label={`Remove ${chip.label} filter`} className="text-gray-400 hover:text-gray-700 transition-colors">
                    <XMarkIcon className="size-3" />
                  </button>
                </span>
              ))}
              <button onClick={clearAll} className="inline-flex items-center gap-1 text-xs font-medium text-gray-400 hover:text-red-500 transition-colors ml-1">
                Clear Filters <XMarkIcon className="size-3" />
              </button>
            </div>
          )}
        </div>

        {/* Results count */}
        <div className="px-4 pt-3 pb-1 shrink-0">
          <p className="text-xs text-gray-400">
            {totalCount === 0 ? 'No listings found' : `${totalCount} listing${totalCount !== 1 ? 's' : ''} found`}
          </p>
        </div>

        {/* Server-rendered card grid (or empty state) */}
        <div className="flex-1 px-4 pb-2">
          {totalCount === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
                <MagnifyingGlassIcon className="size-8 text-gray-300" />
              </div>
              <p className="text-gray-500 font-medium">No listings match your filters</p>
              <p className="text-gray-400 text-sm mt-1">Try adjusting your search or filters</p>
              <button onClick={clearAll} className="mt-4 text-sm text-violet-800 hover:text-violet-900 font-medium">
                Clear all filters
              </button>
            </div>
          ) : (
            children
          )}
        </div>

        {/* Pagination */}
        <div className="px-4 shrink-0">
          <Pagination
            page={currentPage}
            total={totalCount}
            perPage={ITEMS_PER_PAGE}
            onChange={goToPage}
          />
        </div>
      </main>
    </div>
  );
}
