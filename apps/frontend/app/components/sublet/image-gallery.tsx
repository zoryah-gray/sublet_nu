'use client';

import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import { XMarkIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';

// ─── Constants ────────────────────────────────────────────────────────────────

// 5-slot featured layout (≥5 images): 2 left | 1 center large | 2 right
// When total > FEATURED_CAPACITY the last slot (bottom-right) becomes "+N more".
const FEATURED_CAPACITY = 5;

// Simple masonry (<5 images): generic multi-column natural-height grid.
const MASONRY_CAPACITY = 8;

// ─── Image dimension lookup ───────────────────────────────────────────────────
// Width/height are needed so Next.js Image reserves the correct aspect-ratio
// box before the asset loads (prevents CLS). In production these values come
// from the database — written once at upload time, O(1) per render thereafter.

const STOCK_SIZES: Record<string, { w: number; h: number }> = {
  'pexels-artbovich-6447384.jpg':             { w: 1263, h: 843  },
  'pexels-artbovich-7019016.jpg':             { w: 1260, h: 840  },
  'pexels-artbovich-7511695.jpg':             { w: 1260, h: 840  },
  'pexels-misbaa-eri-426041722-36852529.jpg': { w: 800,  h: 1200 },
  'pexels-misbaa-eri-426041722-36852536.jpg': { w: 800,  h: 1200 },
  'pexels-nadin-sh-78971847-33537442.jpg':    { w: 800,  h: 1067 },
  'pexels-rachel-claire-5490367.jpg':         { w: 800,  h: 1067 },
  'pexels-strangehappenings-11757075.jpg':    { w: 1200, h: 800  },
  'pexels-umudicreative-37460692.jpg':        { w: 1200, h: 800  },
};
function sizeOf(src: string) {
  const filename = src.split('/').pop() ?? '';
  return STOCK_SIZES[filename] ?? { w: 1200, h: 800 };
}

// ─── Masonry helpers (used for <5 images) ────────────────────────────────────

function optimalCols(n: number, maxCols = 4): number {
  if (n <= 1) return 1;
  const cap = Math.min(n, maxCols);
  for (let c = cap; c >= 2; c--) if (n % c === 0) return c;
  let best = cap, bestScore = (n % cap) / cap;
  for (let c = cap - 1; c >= 2; c--) {
    const score = (n % c) / c;
    if (score > bestScore) { bestScore = score; best = c; }
  }
  return best;
}

function buildColumns<T>(items: T[], numCols: number): T[][] {
  const base = Math.floor(items.length / numCols);
  const extra = items.length % numCols;
  const cols: T[][] = [];
  let start = 0;
  for (let c = 0; c < numCols; c++) {
    const size = c < extra ? base + 1 : base;
    cols.push(items.slice(start, start + size));
    start += size;
  }
  return cols;
}

type MasonrySlot = { src: string; w: number; h: number; isMore: boolean; originalIdx: number };

// ─── Shared cell sub-component ────────────────────────────────────────────────

function GalleryCell({
  src,
  alt,
  isMore,
  moreCount,
  onClick,
  className = '',
  skeletonAspect,
  showSkeleton,
}: {
  src: string;
  alt: string;
  isMore: boolean;
  moreCount?: number;
  onClick: () => void;
  className?: string;
  skeletonAspect?: string;
  showSkeleton: boolean;
}) {
  const [loaded, setLoaded] = useState(false);

  return (
    <div
      className={`relative overflow-hidden rounded-xl cursor-pointer group ${className}`}
      onClick={onClick}
    >
      {/* Shimmer skeleton — fades out when the image loads */}
      {(!loaded || showSkeleton) && (
        <div
          className="absolute inset-0 shimmer z-10"
          style={skeletonAspect ? { aspectRatio: skeletonAspect } : undefined}
        />
      )}

      <Image
        src={src}
        alt={alt}
        fill
        className="object-cover transition-opacity duration-300"
        style={{ opacity: loaded ? 1 : 0 }}
        sizes="(max-width: 768px) 50vw, 33vw"
        onLoad={() => setLoaded(true)}
      />

      {/* "+N more" overlay */}
      {isMore && (
        <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-white z-20 select-none">
          <span className="text-3xl font-bold leading-none">+{moreCount}</span>
          <span className="text-xs font-medium mt-1 opacity-80">more photos</span>
        </div>
      )}

      {/* Hover tint on regular tiles */}
      {!isMore && (
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/15 transition-colors duration-200 z-10" />
      )}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

interface ImageGalleryProps {
  images: string[];
  title: string;
}

export default function ImageGallery({ images, title }: ImageGalleryProps) {
  const [open, setOpen]           = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  const total = images.length;

  const prev = useCallback(() => setActiveIdx((i) => (i - 1 + total) % total), [total]);
  const next = useCallback(() => setActiveIdx((i) => (i + 1) % total), [total]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft')  prev();
      else if (e.key === 'ArrowRight') next();
      else if (e.key === 'Escape')     setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, prev, next]);

  if (!total) return null;

  const openAt = (idx: number) => { setActiveIdx(idx); setOpen(true); };

  // ── Lightbox modal (portal escapes overflow:hidden ancestors) ──────────────
  const modal = typeof document !== 'undefined' && open && createPortal(
    <div
      className="fixed inset-0 z-9999 bg-black/90 flex items-center justify-center p-4"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-4xl flex flex-col gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between text-white px-1">
          <span className="text-sm text-white/60 tabular-nums">{activeIdx + 1} / {total}</span>
          <button
            onClick={() => setOpen(false)}
            className="p-1.5 rounded-full hover:bg-white/10 transition-colors"
            aria-label="Close gallery"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="relative flex items-center justify-center rounded-2xl overflow-hidden bg-black/30 max-h-[70vh]">
          <Image
            src={images[activeIdx]}
            alt={`${title} — photo ${activeIdx + 1}`}
            width={sizeOf(images[activeIdx]).w}
            height={sizeOf(images[activeIdx]).h}
            className="max-h-[70vh] w-auto h-auto rounded-2xl"
            style={{ objectFit: 'contain', maxWidth: '100%' }}
            priority
          />
          <button onClick={prev} className="absolute left-3 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/70 text-white rounded-full p-2.5 transition-colors" aria-label="Previous photo">
            <ChevronLeftIcon className="w-5 h-5" />
          </button>
          <button onClick={next} className="absolute right-3 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/70 text-white rounded-full p-2.5 transition-colors" aria-label="Next photo">
            <ChevronRightIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 justify-center scrollbar-none">
          {images.map((src, i) => (
            <button key={i} onClick={() => setActiveIdx(i)} className={`shrink-0 w-14 h-10 rounded-lg overflow-hidden border-2 transition-all ${i === activeIdx ? 'border-white opacity-100' : 'border-transparent opacity-50 hover:opacity-80'}`} aria-label={`Go to photo ${i + 1}`}>
              <Image src={src} alt="" width={56} height={40} className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // FEATURED LAYOUT (≥ 5 images)
  // ─────────────────────────────────────────────────────────────────────────
  //   Mobile:  featured top full-width, 4 small images in 2×2 below
  //   Desktop: 1fr left col (2 stacked) | 2fr center (featured) | 1fr right col (2 stacked)
  // ═══════════════════════════════════════════════════════════════════════════
  if (total >= FEATURED_CAPACITY) {
    const hasMore    = total > FEATURED_CAPACITY;
    const moreCount  = total - (FEATURED_CAPACITY - 1);
    // 5 slots: indices 0→top-left, 1→bottom-left, 2→featured-center, 3→top-right, 4→bottom-right
    // When hasMore, slot 4 is a "+N more" button showing images[4] as background.
    const srcs = images.slice(0, FEATURED_CAPACITY);

    return (
      <>
        {/*
          Grid layout:
            Mobile  (< md): 2 cols, 4 rows
              row 1–2: featured (col-span-2, row-span-2)
              row 3:   topLeft | topRight
              row 4:   bottomLeft | bottomRight (or "+N")

            Desktop (≥ md): 3 cols (1fr 2fr 1fr), 2 rows
              col 1 row 1: topLeft
              col 2 row 1–2: featured (row-span-2)
              col 3 row 1: topRight
              col 1 row 2: bottomLeft
              col 3 row 2: bottomRight (or "+N")
        */}
        <div className="grid gap-2 grid-cols-2 grid-rows-4 h-88 md:grid-cols-[1fr_2fr_1fr] md:grid-rows-2 md:h-80">
          {/* ── Featured center ── col-span-2 rows 1-2 on mobile; col 2 row-span-2 on desktop */}
          <div
            className="relative overflow-hidden rounded-xl cursor-pointer group col-span-2 row-span-2 row-start-1 md:col-start-2 md:col-span-1 md:row-start-1 md:row-span-2"
            onClick={() => openAt(2)}
          >
            <div className="absolute inset-0 shimmer z-10" />
            <Image
              src={srcs[2]}
              alt={`${title} — featured photo`}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 50vw"
              onLoad={(e) => ((e.target as HTMLElement).parentElement?.querySelector('.shimmer') as HTMLElement | null)?.remove()}
              priority
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/15 transition-colors duration-200 z-10" />
          </div>

          {/* ── Top-left ── */}
          <GalleryCell
            src={srcs[0]}
            alt={`${title} — photo 1`}
            isMore={false}
            onClick={() => openAt(0)}
            showSkeleton={false}
            className="col-start-1 row-start-3 md:col-start-1 md:row-start-1"
          />

          {/* ── Top-right ── */}
          <GalleryCell
            src={srcs[3]}
            alt={`${title} — photo 4`}
            isMore={false}
            onClick={() => openAt(3)}
            showSkeleton={false}
            className="col-start-2 row-start-3 md:col-start-3 md:row-start-1"
          />

          {/* ── Bottom-left ── */}
          <GalleryCell
            src={srcs[1]}
            alt={`${title} — photo 2`}
            isMore={false}
            onClick={() => openAt(1)}
            showSkeleton={false}
            className="col-start-1 row-start-4 md:col-start-1 md:row-start-2"
          />

          {/* ── Bottom-right (or "+N more") ── */}
          <GalleryCell
            src={srcs[4] ?? srcs[3]}
            alt={`${title} — photo 5`}
            isMore={hasMore}
            moreCount={moreCount}
            onClick={() => openAt(hasMore ? 4 : 4)}
            showSkeleton={false}
            className="col-start-2 row-start-4 md:col-start-3 md:row-start-2"
          />
        </div>

        {modal}
      </>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SIMPLE MASONRY (< 5 images) — natural image heights, balanced columns
  // ═══════════════════════════════════════════════════════════════════════════
  const hasMoreM    = total > MASONRY_CAPACITY;
  const visibleCnt  = hasMoreM ? MASONRY_CAPACITY - 1 : total;

  const masonrySlots: MasonrySlot[] = [
    ...images.slice(0, visibleCnt).map((src, i) => ({
      src, ...sizeOf(src), isMore: false, originalIdx: i,
    })),
    ...(hasMoreM ? [{ src: images[visibleCnt], ...sizeOf(images[visibleCnt]), isMore: true, originalIdx: visibleCnt }] : []),
  ];

  const numCols  = optimalCols(masonrySlots.length);
  const columns  = buildColumns(masonrySlots, numCols);
  const gridCls  =
    numCols === 1 ? 'grid-cols-1' :
    numCols === 2 ? 'grid-cols-2' :
    numCols === 3 ? 'grid-cols-3' :
    'grid-cols-2 md:grid-cols-4';

  return (
    <>
      <div className={`grid ${gridCls} gap-2`}>
        {columns.map((col, ci) => (
          <div key={ci} className="grid gap-2 content-start">
            {col.map((slot, ri) => (
              <div
                key={`${ci}-${ri}`}
                className="relative rounded-xl overflow-hidden cursor-pointer group"
                onClick={() => openAt(slot.isMore ? visibleCnt : slot.originalIdx)}
              >
                {/* Skeleton placeholder — correct aspect ratio so layout height is reserved */}
                <div
                  className="shimmer"
                  style={{ aspectRatio: `${slot.w} / ${slot.h}` }}
                />

                <Image
                  src={slot.src}
                  alt={`${title} — photo ${slot.originalIdx + 1}`}
                  width={slot.w}
                  height={slot.h}
                  className="absolute inset-0 w-full h-full object-cover transition-opacity duration-300"
                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                  onLoad={(e) => { (e.target as HTMLElement).style.opacity = '1'; }}
                  style={{ opacity: 0 }}
                />

                {slot.isMore ? (
                  <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-white z-20 select-none">
                    <span className="text-3xl font-bold leading-none">+{total - visibleCnt}</span>
                    <span className="text-xs font-medium mt-1 opacity-80">more photos</span>
                  </div>
                ) : (
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/15 transition-colors duration-200 z-10" />
                )}
              </div>
            ))}
          </div>
        ))}
      </div>

      {modal}
    </>
  );
}
