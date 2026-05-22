'use client';

import { useState } from 'react';
import Link from 'next/link';
import { HeartIcon, MapPinIcon } from '@heroicons/react/24/outline';
import { HeartIcon as HeartSolid } from '@heroicons/react/24/solid';
import type { Sublet } from '@/app/lib/mock-data';

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

const SEASON_COLORS: Record<string, string> = {
  Fall: 'bg-amber-50 text-amber-700',
  Winter: 'bg-sky-50 text-sky-700',
  Spring: 'bg-green-50 text-green-700',
  Summer: 'bg-orange-50 text-orange-700',
};

export default function SubletCard({ sublet }: { sublet: Sublet }) {
  const [favorited, setFavorited] = useState(false);

  return (
    <div className="relative rounded-xl border border-gray-200 bg-white overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 group">
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setFavorited((f) => !f);
        }}
        aria-label={favorited ? 'Remove from favorites' : 'Save to favorites'}
        className="absolute top-2.5 right-2.5 z-10 p-1.5 rounded-full bg-white/80 backdrop-blur-sm hover:bg-white transition-colors shadow-sm"
      >
        {favorited ? (
          <HeartSolid className="w-4 h-4 text-red-500 cursor-pointer" />
        ) : (
          <HeartIcon className="w-4 h-4 text-gray-400 group-hover:text-gray-500 transition-colors cursor-pointer" />
        )}
      </button>

      <Link href={`/sublet/${sublet.id}`} className="block">
        <PlaceholderImage hue={sublet.imageHue} />

        <div className="p-3">
          <p className="font-semibold text-gray-900 text-sm leading-snug truncate">
            {sublet.title}
          </p>

          <div className="flex items-center gap-1 mt-0.5 text-xs text-gray-400">
            <MapPinIcon className="w-3 h-3 flex-shrink-0" />
            <span className="truncate">{sublet.neighborhood}</span>
          </div>

          <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
            <span>{sublet.beds === 0 ? 'Studio' : `${sublet.beds} bed`}</span>
            <span className="text-gray-200">·</span>
            <span>{sublet.baths} bath</span>
            <span className="text-gray-200">·</span>
            <span>{sublet.sqft.toLocaleString()} sqft</span>
          </div>

          <div className="flex flex-wrap gap-1 mt-2">
            {sublet.seasons.map((season) => (
              <span
                key={season}
                className={`text-xs px-2 py-0.5 rounded-full font-medium ${SEASON_COLORS[season]}`}
              >
                {season}
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
