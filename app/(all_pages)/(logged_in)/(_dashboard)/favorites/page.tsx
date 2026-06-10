'use client';

import { useState, useMemo, useEffect } from 'react';
import SubletCard from '@/app/components/sublet/sublet-card';
import SearchBar from '@/app/components/search-bar';
import Pagination from '@/app/components/pagination';
import { MOCK_FAVORITE_SUBLETS } from '@/app/lib/mock-data';
import type { Sublet } from '@/app/lib/definitions';
import { HeartIcon } from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

const FAVORITES_PER_PAGE = 4;

export default function FavoritesPage() {
  const [favorites, setFavorites] = useState<Sublet[]>(MOCK_FAVORITE_SUBLETS);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return favorites.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        s.neighborhood.toLowerCase().includes(q) ||
        s.address.toLowerCase().includes(q)
    );
  }, [favorites, query]);

  // Reset to page 1 whenever the search query changes
  useEffect(() => { setPage(1); }, [query]);

  const pageItems = filtered.slice((page - 1) * FAVORITES_PER_PAGE, page * FAVORITES_PER_PAGE);

  const handleFavoriteChange = (id: string, isFavorited: boolean) => {
    if (!isFavorited) {
      setFavorites((prev) => prev.filter((s) => s.id !== id));
    }
  };

  return (
    <main className="flex-1 overflow-y-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Saved Listings</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {favorites.length} {favorites.length === 1 ? 'listing' : 'listings'} saved
          </p>
        </div>
      </div>

      {/* Search */}
      {favorites.length > 0 && (
        <SearchBar
          value={query}
          onChange={setQuery}
          placeholder="Search saved listings…"
          className="mb-5 max-w-md"
        />
      )}

      {/* Empty state — no favorites at all */}
      {favorites.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-gray-400">
          <HeartIcon className="size-12" />
          <p className="text-base font-medium">No saved listings yet.</p>
          <p className="text-sm">Browse listings and tap the heart to save them here.</p>
          <Button variant="outline" size="sm" className="mt-2" asChild>
            <Link href="/browse">Browse listings</Link>
          </Button>
        </div>
      )}

      {/* Empty state — search returned nothing */}
      {favorites.length > 0 && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 gap-2 text-gray-400">
          <p className="text-sm">No saved listings match &ldquo;{query}&rdquo;.</p>
          <button onClick={() => setQuery('')} className="text-xs text-violet-600 hover:underline">
            Clear search
          </button>
        </div>
      )}

      {/* Grid */}
      {filtered.length > 0 && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {pageItems.map((s) => (
              <SubletCard
                key={s.id}
                sublet={s}
                initialFavorited
                onFavoriteChange={(fav: boolean) => handleFavoriteChange(s.id, fav)}
              />
            ))}
          </div>

          <Pagination
            page={page}
            total={filtered.length}
            perPage={FAVORITES_PER_PAGE}
            onChange={setPage}
          />
        </>
      )}
    </main>
  );
}
