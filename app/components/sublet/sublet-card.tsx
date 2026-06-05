// Server component — no 'use client'.
// Only the heart button (CardFavoriteButton) is a client island.
import Link from 'next/link';
import { MapPinIcon } from '@heroicons/react/24/outline';
import { CURRENT_USER_ID } from '@/app/lib/mock-data';
import type { Sublet } from '@/app/lib/mock-data';
import CardFavoriteButton from '@/app/components/sublet/card-favorite-button';

function PlaceholderImage({ hue }: { hue: string }) {
  return (
    <div
      className="w-full h-40 flex items-center justify-center"
      style={{ backgroundColor: `hsl(${hue} 60% 92%)` }}
    >
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center"
        style={{ backgroundColor: `hsl(${hue} 55% 75%)` }}
      >
        <svg
          className="w-7 h-7 text-white"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75"
          />
        </svg>
      </div>
    </div>
  );
}

const QUARTER_COLORS: Record<string, string> = {
  Fall:   'bg-amber-50 text-amber-700',
  Winter: 'bg-sky-50 text-sky-700',
  Spring: 'bg-green-50 text-green-700',
  Summer: 'bg-orange-50 text-orange-700',
};

interface SubletCardProps {
  sublet: Sublet;
  initialFavorited?: boolean;
  // Callback is only used when this card appears inside a client tree (e.g. FavoritesPage).
  // When rendered server-side (e.g. browse), it is omitted.
  onFavoriteChange?: (favorited: boolean) => void;
}

export default function SubletCard({
  sublet,
  initialFavorited = false,
  onFavoriteChange,
}: SubletCardProps) {
  const isOwner = sublet.ownerId === CURRENT_USER_ID;

  return (
    <div className="relative rounded-xl border border-gray-200 bg-white overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 group">
      {isOwner && (
        <span className="absolute top-2.5 left-2.5 z-10 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-violet-700 text-white shadow-sm">
          Your listing
        </span>
      )}

      {/* Client island — only the heart button is hydrated */}
      <CardFavoriteButton
        initialFavorited={initialFavorited}
        onFavoriteChange={onFavoriteChange}
        isOwner={isOwner}
      />

      <Link href={`/sublet/${sublet.id}`} className="block">
        {sublet.featuredImage ? (
          <img
            src={sublet.featuredImage}
            alt={sublet.title}
            className="w-full h-40 object-cover"
          />
        ) : (
          <PlaceholderImage hue={sublet.imageHue} />
        )}

        <div className="p-3">
          <p className="font-semibold text-gray-900 text-sm leading-snug truncate">
            {sublet.title}
          </p>

          <div className="flex items-center gap-1 mt-0.5 text-xs text-gray-400">
            <MapPinIcon className="w-3 h-3 shrink-0" />
            <span className="truncate">{sublet.neighborhood}</span>
          </div>

          <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
            <span>{sublet.beds === 0 ? 'Studio' : `${sublet.beds} bed`}</span>
            <span className="text-gray-200">·</span>
            <span>{sublet.baths} bath</span>
          </div>

          <div className="flex flex-wrap gap-1 mt-2">
            {sublet.quarters.map((quarter) => (
              <span
                key={quarter}
                className={`text-xs px-2 py-0.5 rounded-full font-medium ${QUARTER_COLORS[quarter]}`}
              >
                {quarter}
              </span>
            ))}
          </div>

          <p className="mt-2.5 font-bold text-violet-800 text-sm">
            ${sublet.price.toLocaleString()}
            <span className="text-xs font-normal text-gray-400">/mo</span>
          </p>
        </div>
      </Link>
    </div>
  );
}
