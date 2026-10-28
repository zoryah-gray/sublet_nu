// Server component — no 'use client'.
// Reads searchParams, filters and paginates server-side, then passes the
// resulting card grid to BrowseFiltersClient as children.  The client island
// handles all interactivity and re-renders this page by pushing new URL params.
import { Suspense } from 'react';
import SubletCard from '@/app/components/sublet/sublet-card';
import BrowseFiltersClient from './browse-filters-client';
import type { UrlFilters } from './browse-filters-client';
import { MOCK_SUBLETS, getFilteredSublets } from '@/app/lib/mock-data';
import { ITEMS_PER_PAGE, type SortOrder } from '@/app/lib/definitions';
import type { Term, TermBadge } from '@sublet-nu/shared';
import { getOfferedTerms, parseTermParam } from '@/app/lib/academic-terms';
import { toPublicSublet } from '@/app/lib/util-address';

// ─── Price histogram (server-side) ───────────────────────────────────────────
//
// Computed once per request from the listing prices.
// When a real DB is connected, replace this with a single aggregation query
// (e.g. SELECT MAX(price), histogram_agg(price, 20) FROM listings).
// The client never touches raw listing data — only these three derived values.

const BUCKET_COUNT = 20;

function computePriceHistogram(prices: number[]) {
  const max = prices.length ? Math.max(...prices) : 0;
  // Round up to the nearest $500 for a clean slider ceiling.
  const dataMaxPrice = Math.ceil(max / 500) * 500 || 500;
  const bucketWidth  = dataMaxPrice / BUCKET_COUNT;

  const priceBuckets = Array.from({ length: BUCKET_COUNT }, () => 0);
  for (const p of prices) {
    priceBuckets[Math.min(Math.floor(p / bucketWidth), BUCKET_COUNT - 1)]++;
  }
  const bucketMax = Math.max(...priceBuckets, 1);

  return { dataMaxPrice, priceBuckets, bucketMax, bucketWidth };
}

// ─── Map placeholder (static, server-rendered) ────────────────────────────────

// ─── Param parsing ────────────────────────────────────────────────────────────

/** The client-safe part of a term: no dates needed to render a chip. */
function toBadge({ id, quarter, label }: Term): TermBadge {
  return { id, quarter, label };
}

function parseFilters(
  p: Record<string, string | string[] | undefined>,
  dataMaxPrice: number,
  selectedTerms: Term[],
): UrlFilters {
  const raw = (k: string) => (typeof p[k] === 'string' ? (p[k] as string) : undefined);

  const rawMax   = raw('maxPrice');
  const maxPrice = rawMax != null
    ? Math.min(dataMaxPrice, Math.max(0, Number(rawMax)))
    : dataMaxPrice;

  return {
    query:     raw('q') ?? '',
    minPrice:  Math.max(0, Number(raw('minPrice') ?? 0) || 0),
    maxPrice,
    sortOrder: (['asc', 'desc', 'new'].includes(raw('sort') ?? '') ? raw('sort') as SortOrder : 'new'),
    terms: selectedTerms.map(toBadge),
  };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function BrowsePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;

  // Compute histogram data from all listings (future: single DB aggregation query).
  const { dataMaxPrice, priceBuckets, bucketMax, bucketWidth } =
    computePriceHistogram(MOCK_SUBLETS.map((s) => s.monthlyRent));

  // Terms offered today; an invalid or non-contiguous ?terms= means no term filter.
  const offeredTerms = getOfferedTerms();
  const selectedTerms = parseTermParam(typeof params.terms === 'string' ? params.terms : undefined, offeredTerms);
  const filters = parseFilters(params, dataMaxPrice, selectedTerms);
  const page    = Math.max(1, Number(typeof params.page === 'string' ? params.page : '1') || 1);

  const filtered = getFilteredSublets({
    query: filters.query || undefined,
    terms: selectedTerms.length ? selectedTerms : undefined,
    minPrice: filters.minPrice > 0 ? filters.minPrice : undefined,
    maxPrice: filters.maxPrice < dataMaxPrice ? filters.maxPrice : undefined,
    sortOrder: filters.sortOrder !== 'new' ? filters.sortOrder : undefined,
  });

  // Only public shapes cross into Client Components (cards, map) — see toPublicSublet.
  const publicSublets = filtered.map(toPublicSublet);
  const pageSublets = publicSublets.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const cardGrid = (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
      {pageSublets.map((sublet) => (
        <div key={sublet.id} id={`card-${sublet.id}`} className="contents">
          <SubletCard sublet={sublet} />
        </div>
      ))}
    </div>
  );

  return (
    <Suspense fallback={<div className="flex-1 animate-pulse bg-gray-50" />}>
      <BrowseFiltersClient
        currentFilters={filters}
        offeredTerms={offeredTerms.map(toBadge)}
        totalCount={filtered.length}
        currentPage={page}
        dataMaxPrice={dataMaxPrice}
        priceBuckets={priceBuckets}
        bucketMax={bucketMax}
        bucketWidth={bucketWidth}
        sublets={publicSublets}
      >
        {cardGrid}
      </BrowseFiltersClient>
    </Suspense>
  );
}
