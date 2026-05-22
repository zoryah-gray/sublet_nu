'use client';

import { useState, useMemo, useEffect } from 'react';
import { format } from 'date-fns';
import type { DateRange } from 'react-day-picker';
import {
  MagnifyingGlassIcon,
  MapPinIcon,
  FunnelIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { CalendarIcon } from 'lucide-react';
import NavBar from '@/app/components/navbar';
import SubletCard from '@/app/ui/sublet-card';
import Pagination from '@/app/ui/pagination';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import {
  MOCK_SUBLETS,
  ITEMS_PER_PAGE,
  getFilteredSublets,
  type Season,
  type SortOrder,
} from '@/app/lib/mock-data';

// ─── Types ────────────────────────────────────────────────────────────────────

type PlaceType = 'entire' | 'private';

type FilterState = {
  query: string;
  minPrice: number;
  maxPrice: number;
  sortOrder: SortOrder;
  seasons: Season[];
  dateRange: DateRange | undefined;
  placeType: PlaceType | undefined;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const ALL_SEASONS: Season[] = ['Fall', 'Winter', 'Spring', 'Summer'];
const SEASON_COLORS: Record<Season, { on: string; off: string }> = {
  Fall:   { on: 'bg-amber-500 text-white border-amber-500',   off: 'border-amber-200 text-amber-700 hover:bg-amber-50' },
  Winter: { on: 'bg-sky-500 text-white border-sky-500',       off: 'border-sky-200 text-sky-700 hover:bg-sky-50' },
  Spring: { on: 'bg-green-500 text-white border-green-500',   off: 'border-green-200 text-green-700 hover:bg-green-50' },
  Summer: { on: 'bg-orange-500 text-white border-orange-500', off: 'border-orange-200 text-orange-700 hover:bg-orange-50' },
};

const MAX_PRICE = 5000;
const BUCKET_COUNT = 20;
const BUCKET_WIDTH = MAX_PRICE / BUCKET_COUNT;

const PRICE_BUCKETS = (() => {
  const buckets = new Array<number>(BUCKET_COUNT).fill(0);
  for (const s of MOCK_SUBLETS) {
    const idx = Math.min(Math.floor(s.price / BUCKET_WIDTH), BUCKET_COUNT - 1);
    buckets[idx]++;
  }
  return buckets;
})();
const BUCKET_MAX = Math.max(...PRICE_BUCKETS, 1);

const PLACE_TYPES: { value: PlaceType; label: string; description: string }[] = [
  { value: 'entire',  label: 'Entire place',  description: 'A place all to yourself' },
  { value: 'private', label: 'Private place', description: 'Your own room in a home or a hotel, plus some shared common spaces' },
];

// ─── Active filter chips ──────────────────────────────────────────────────────

type Chip = { key: string; category: string; label: string; onRemove: () => void };

function buildChips(
  filters: FilterState,
  update: (partial: Partial<FilterState>) => void
): Chip[] {
  const chips: Chip[] = [];

  if (filters.sortOrder === 'asc')
    chips.push({ key: 'sort', category: 'Sort', label: 'Price ↑', onRemove: () => update({ sortOrder: 'new' }) });
  if (filters.sortOrder === 'desc')
    chips.push({ key: 'sort', category: 'Sort', label: 'Price ↓', onRemove: () => update({ sortOrder: 'new' }) });

  for (const season of filters.seasons)
    chips.push({
      key: `season-${season}`,
      category: 'Quarter',
      label: season,
      onRemove: () => update({ seasons: filters.seasons.filter((s) => s !== season) }),
    });

  if (filters.minPrice > 0 || filters.maxPrice < MAX_PRICE) {
    const lo = `$${filters.minPrice.toLocaleString()}`;
    const hi = filters.maxPrice >= MAX_PRICE ? '5k+' : `$${filters.maxPrice.toLocaleString()}`;
    chips.push({
      key: 'price',
      category: 'Price',
      label: `${lo} – ${hi}`,
      onRemove: () => update({ minPrice: 0, maxPrice: MAX_PRICE }),
    });
  }

  if (filters.query.trim())
    chips.push({
      key: 'query',
      category: 'Search',
      label: `"${filters.query}"`,
      onRemove: () => update({ query: '' }),
    });

  if (filters.dateRange?.from) {
    const from = format(filters.dateRange.from, 'MMM d, yyyy');
    const to = filters.dateRange.to ? format(filters.dateRange.to, 'MMM d, yyyy') : '…';
    chips.push({
      key: 'date',
      category: 'Dates',
      label: `${from} – ${to}`,
      onRemove: () => update({ dateRange: undefined }),
    });
  }

  if (filters.placeType)
    chips.push({
      key: 'place',
      category: 'Place',
      label: filters.placeType === 'entire' ? 'Entire place' : 'Private place',
      onRemove: () => update({ placeType: undefined }),
    });

  return chips;
}

// ─── Price Histogram ──────────────────────────────────────────────────────────

function PriceHistogram({ minPrice, maxPrice }: { minPrice: number; maxPrice: number }) {
  return (
    <div className="flex items-end gap-0.5 mb-0! mbe-0! h-10 pointer-events-none" aria-hidden>
      {PRICE_BUCKETS.map((count, i) => {
        const bucketMid = (i + 0.5) * BUCKET_WIDTH;
        const inRange = bucketMid >= minPrice && bucketMid <= maxPrice;
        const heightPct = (count / BUCKET_MAX) * 100;
        return (
          <div
            key={i}
            className={cn(
              'flex-1 rounded-t-xs transition-colors duration-150',
              inRange ? 'bg-primary/40' : 'bg-gray-200'
            )}
            style={{ height: heightPct > 0 ? `${heightPct}%` : 0, minHeight: count > 0 ? 2 : 0 }}
          />
        );
      })}
    </div>
  );
}

// ─── Price Input ──────────────────────────────────────────────────────────────

function PriceInput({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  const commit = () => {
    const n = parseInt(draft.replace(/[^0-9]/g, ''), 10);
    const clamped = isNaN(n) ? value : Math.max(min, Math.min(max, n));
    onChange(clamped);
    setDraft(String(clamped));
  };

  return (
    <div className="flex-1 rounded-xl border border-gray-200 px-3 py-2">
      <p className="text-xs text-gray-400">{label}</p>
      <div className="flex items-center gap-0.5 mt-0.5">
        <span className="text-sm font-medium text-gray-900">$</span>
        <input
          className="w-0 flex-1 text-sm font-medium text-gray-900 bg-transparent outline-none cursor-text"
          value={draft}
          onChange={(e) => setDraft(e.target.value.replace(/[^0-9]/g, ''))}
          onBlur={commit}
          onKeyDown={(e) => e.key === 'Enter' && commit()}
        />
      </div>
    </div>
  );
}

// ─── Map Placeholder ──────────────────────────────────────────────────────────

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

// ─── Filter Sidebar ───────────────────────────────────────────────────────────

function FilterSidebar({
  filters,
  onChange,
  onClose,
}: {
  filters: FilterState;
  onChange: (f: Partial<FilterState>) => void;
  onClose: () => void;
}) {
  const [calendarOpen, setCalendarOpen] = useState(false);

  const toggleSeason = (s: Season) => {
    const next = filters.seasons.includes(s)
      ? filters.seasons.filter((x) => x !== s)
      : [...filters.seasons, s];
    onChange({ seasons: next });
  };

  return (
    <div className="h-full flex flex-col">

      {/* Sticky header */}
      <div className="flex-none px-4 pt-5 pb-3 bg-background">
        <div className="flex justify-between">
          <div className="flex items-center gap-1.5">
            <p className="text-2xl font-bold text-gray-900">Filters</p>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onClose}
            aria-label="Close filters"
            className="text-gray-400 hover:text-gray-600"
          >
            <XMarkIcon className="size-5" />
          </Button>
        </div>
        <Separator className="mt-3" />
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-4 pb-5 space-y-6">

      {/* ── Price Range ── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Price Range</h2>
          <button
            onClick={() => onChange({ minPrice: 0, maxPrice: MAX_PRICE })}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            Reset
          </button>
        </div>

        {/* Distribution histogram */}
        <PriceHistogram minPrice={filters.minPrice} maxPrice={filters.maxPrice} />

        {/* Dual-thumb range slider */}
        <Slider
          min={0}
          max={MAX_PRICE}
          step={50}
          value={[filters.minPrice, filters.maxPrice]}
          onValueChange={(values) => onChange({ minPrice: values[0], maxPrice: values[1] })}
        />

        {/* Min / Max text inputs */}
        <div className="flex gap-2 pt-1">
          <PriceInput
            label="Min price"
            value={filters.minPrice}
            min={0}
            max={filters.maxPrice}
            onChange={(v) => onChange({ minPrice: v })}
          />
          <PriceInput
            label="Max price"
            value={filters.maxPrice}
            min={filters.minPrice}
            max={MAX_PRICE}
            onChange={(v) => onChange({ maxPrice: v })}
          />
        </div>

        {/* Sort by price */}
        <div className="pt-2 space-y-1.5">
          <p className="text-xs text-muted-foreground">Sort by price</p>
          <div className="flex gap-2">
            <Button
              variant={filters.sortOrder === 'desc' ? 'default' : 'outline'}
              size="xs"
              className="flex-1"
              onClick={() => onChange({ sortOrder: filters.sortOrder === 'desc' ? 'new' : 'desc' })}
            >
              Descending ↓
            </Button>
            <Button
              variant={filters.sortOrder === 'asc' ? 'default' : 'outline'}
              size="xs"
              className="flex-1"
              onClick={() => onChange({ sortOrder: filters.sortOrder === 'asc' ? 'new' : 'asc' })}
            >
              Ascending ↑
            </Button>
          </div>
        </div>
      </div>

      <Separator />

      {/* ── Duration ── */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">Duration</h2>

        {/* Quarter chips */}
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">Quarter Available</h3>
          {filters.seasons.length > 0 && (
            <button
              onClick={() => onChange({ seasons: [] })}
              className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
            >
              Reset
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {ALL_SEASONS.map((season) => {
            const active = filters.seasons.includes(season);
            return (
              <button
                key={season}
                onClick={() => toggleSeason(season)}
                className={cn(
                  'text-xs px-3 py-1.5 rounded-full border font-medium transition-colors',
                  active ? SEASON_COLORS[season].on : SEASON_COLORS[season].off
                )}
              >
                {season}
              </button>
            );
          })}
        </div>

        {/* Date range picker */}
        <div className="space-y-1.5 mt-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">Dates Available</h3>
            {filters.dateRange?.from && (
              <button
                onClick={() => onChange({ dateRange: undefined })}
                className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
              >
                Reset
              </button>
            )}
          </div>
          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="w-full justify-start text-left font-normal">
                <CalendarIcon className="size-3.5 text-muted-foreground shrink-0" />
                {filters.dateRange?.from ? (
                  <span className="text-xs">
                    {format(filters.dateRange.from, 'MMM d')}
                    {' – '}
                    {filters.dateRange.to ? format(filters.dateRange.to, 'MMM d, yyyy') : '…'}
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">Pick a date range</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="range"
                selected={filters.dateRange}
                onSelect={(range) => onChange({ dateRange: range ?? undefined })}
                numberOfMonths={1}
              />
              {filters.dateRange?.from && (
                <div className="border-t px-3 py-2">
                  <Button
                    variant="ghost"
                    size="xs"
                    className="w-full text-xs text-muted-foreground"
                    onClick={() => { onChange({ dateRange: undefined }); setCalendarOpen(false); }}
                  >
                    Clear dates
                  </Button>
                </div>
              )}
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <Separator />

      {/* ── Type of Place ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Type of Place</h2>
          {filters.placeType && (
            <button
              onClick={() => onChange({ placeType: undefined })}
              className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
            >
              Reset
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-1 gap-2">
          {PLACE_TYPES.map((place) => (
            <button
              key={place.value}
              onClick={() => onChange({ placeType: filters.placeType === place.value ? undefined : place.value })}
              className={cn(
                'flex flex-col items-start text-left p-3 rounded-xl transition-all',
                filters.placeType === place.value
                  ? 'border-2 border-primary'
                  : 'border border-gray-200 hover:border-border'
              )}
            >
              <span className="text-sm font-semibold text-gray-900">{place.label}</span>
              <span className="text-xs text-gray-500 mt-1 leading-relaxed">{place.description}</span>
            </button>
          ))}
        </div>
      </div>

      <Separator className='mb-3' />

      {/* Reset all */}
      <Button
        variant="outline"
        size="sm"
        className="w-full"
        onClick={() =>
          onChange({
            minPrice: 0,
            maxPrice: MAX_PRICE,
            sortOrder: 'new',
            seasons: [],
            query: '',
            dateRange: undefined,
            placeType: undefined,
          })
        }
      >
        Reset all filters
      </Button>
    </div>
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
  dateRange: undefined,
  placeType: undefined,
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
  const activeChips = buildChips(filters, updateFilters);
  const hasActiveFilters = activeChips.length > 0;

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-white">
      <NavBar />

      <div className="flex flex-1 overflow-hidden relative">

        {/* ── Filter sidebar ── */}
        <aside
          className={cn(
            'absolute inset-y-0 left-0 z-20 w-72 bg-white border-r border-gray-200 transition-transform duration-200 shrink-0',
            showFilters ? 'translate-x-0 shadow-xl' : '-translate-x-full'
          )}
        >
          <FilterSidebar
            filters={filters}
            onChange={updateFilters}
            onClose={() => setShowFilters(false)}
          />
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

          {/* Search + filter bar */}
          <div className="px-4 pt-4 pb-3 border-b border-gray-100 space-y-2 shrink-0">
            <div className="flex items-center gap-2">

              {/* Filter toggle */}
              <Button
                variant={showFilters || hasActiveFilters ? 'default' : 'outline'}
                size="sm"
                onClick={() => setShowFilters((v) => !v)}
                className={cn(
                  'shrink-0',
                  (showFilters || hasActiveFilters) &&
                    'bg-violet-800 text-white border-violet-800 hover:bg-violet-900 hover:border-violet-900'
                )}
              >
                <FunnelIcon className="size-4" />
                <span className="hidden sm:inline">Filters</span>
              </Button>

              {/* Search input */}
              <div className="flex-1 flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 h-9 focus-within:border-violet-500 focus-within:bg-white transition-colors">
                <MagnifyingGlassIcon className="size-4 text-gray-400 shrink-0" />
                <input
                  type="text"
                  placeholder="Search by title, address, or neighborhood…"
                  value={filters.query}
                  onChange={(e) => updateFilters({ query: e.target.value })}
                  className="flex-1 bg-transparent text-sm text-gray-800 placeholder-gray-400 outline-none cursor-text"
                />
                {filters.query && (
                  <button
                    onClick={() => updateFilters({ query: '' })}
                    className="text-gray-400 hover:text-gray-600"
                    aria-label="Clear search"
                  >
                    <XMarkIcon className="size-4" />
                  </button>
                )}
              </div>
            </div>

            {/* ── Active filter chips ── */}
            {hasActiveFilters && (
              <div className="flex flex-wrap gap-1.5 items-center">
                {activeChips.map((chip) => (
                  <span
                    key={chip.key}
                    className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-2.5 py-1 text-xs shadow-sm"
                  >
                    <span className="size-1.5 rounded-full bg-primary shrink-0" />
                    <span className="font-semibold text-gray-700">{chip.category}</span>
                    <span className="text-gray-500">{chip.label}</span>
                    <button
                      onClick={chip.onRemove}
                      aria-label={`Remove ${chip.label} filter`}
                      className="text-gray-400 hover:text-gray-700 transition-colors"
                    >
                      <XMarkIcon className="size-3" />
                    </button>
                  </span>
                ))}
                <button
                  onClick={() => { setFilters(DEFAULT_FILTERS); setPage(1); }}
                  className="inline-flex items-center gap-1 text-xs font-medium text-gray-400 hover:text-red-500 transition-colors ml-1"
                >
                  Clear Filters
                  <XMarkIcon className="size-3" />
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
                  <MagnifyingGlassIcon className="size-8 text-gray-300" />
                </div>
                <p className="text-gray-500 font-medium">No listings match your filters</p>
                <p className="text-gray-400 text-sm mt-1">Try adjusting your search or filters</p>
                <button
                  onClick={() => { setFilters(DEFAULT_FILTERS); setPage(1); }}
                  className="mt-4 text-sm text-violet-800 hover:text-violet-900 font-medium"
                >
                  Clear all filters
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
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
