'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { HeartIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { cn } from '@/lib/utils';
import { MOCK_FAVORITE_SUBLETS } from '@/app/lib/mock-data';
import SubletMiniCard from '@/app/components/sublet/sublet-mini-card';

const PREVIEW_LIMIT = 8;
const SCROLL_STEP = 160;

export default function FavoritesScrollCard() {
  const preview = MOCK_FAVORITE_SUBLETS.slice(0, PREVIEW_LIMIT);
  const hasMore = MOCK_FAVORITE_SUBLETS.length > PREVIEW_LIMIT;

  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft,  setCanScrollLeft]  = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 1);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    checkScroll();
    el.addEventListener('scroll', checkScroll, { passive: true });
    const ro = new ResizeObserver(checkScroll);
    ro.observe(el);
    return () => { el.removeEventListener('scroll', checkScroll); ro.disconnect(); };
  }, [checkScroll]);

  const scroll = (dir: 'left' | 'right') =>
    scrollRef.current?.scrollBy({ left: dir === 'left' ? -SCROLL_STEP : SCROLL_STEP, behavior: 'smooth' });

  if (preview.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Favorites</h2>
        </div>
        <div className="p-5 flex flex-col items-center justify-center py-10 gap-2 text-gray-400">
          <HeartIcon className="size-8" />
          <p className="text-sm">No saved listings yet.</p>
          <Button variant="outline" size="sm" className="mt-2" asChild>
            <Link href="/browse">Browse listings</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100">
        <h2 className="text-base font-semibold text-gray-900">Favorites</h2>
      </div>
      <div className="p-5">
        <div className="relative">
          {canScrollLeft && (
            <button onClick={() => scroll('left')} aria-label="Scroll left" className="absolute left-0 top-1/2 -translate-y-1/2 z-10 -ml-2 size-7 rounded-full bg-white border border-gray-200 shadow-sm flex items-center justify-center text-gray-500 hover:text-gray-900 hover:shadow-md transition-all">
              <ChevronLeftIcon className="size-4" />
            </button>
          )}
          {canScrollRight && (
            <button onClick={() => scroll('right')} aria-label="Scroll right" className="absolute right-0 top-1/2 -translate-y-1/2 z-10 -mr-2 size-7 rounded-full bg-white border border-gray-200 shadow-sm flex items-center justify-center text-gray-500 hover:text-gray-900 hover:shadow-md transition-all">
              <ChevronRightIcon className="size-4" />
            </button>
          )}
          {canScrollLeft  && <div className="absolute left-0  inset-y-0 w-10 bg-linear-to-r from-white to-transparent pointer-events-none z-5" />}
          {canScrollRight && <div className="absolute right-0 inset-y-0 w-10 bg-linear-to-l from-white to-transparent pointer-events-none z-5" />}

          <div ref={scrollRef} className="flex gap-3 overflow-x-auto pb-1 snap-x snap-mandatory scrollbar-none">
            {preview.map((s, i) => (
              <div key={s.id} className={cn('w-36 shrink-0 snap-start', i >= 4 && 'hidden md:block')}>
                <SubletMiniCard sublet={s} initialFavorited />
              </div>
            ))}
          </div>
        </div>

        {hasMore && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <Button variant="ghost" size="sm" className="w-full text-violet-700 hover:text-violet-900 hover:bg-violet-50" asChild>
              <Link href="/favorites">View all {MOCK_FAVORITE_SUBLETS.length} saved listings →</Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
