// Server component — no 'use client'.
// Only the heart button (CardFavoriteButton) is a client island.
import Link from 'next/link';
import { CURRENT_USER_ID } from '@/app/lib/mock-data';
import type { Sublet } from '@/app/lib/mock-data';
import CardFavoriteButton from '@/app/components/sublet/card-favorite-button';

interface SubletMiniCardProps {
  sublet: Sublet;
  initialFavorited?: boolean;
  onFavoriteChange?: (favorited: boolean) => void;
}

export default function SubletMiniCard({
  sublet,
  initialFavorited = false,
  onFavoriteChange,
}: SubletMiniCardProps) {
  const isOwner = sublet.ownerId === CURRENT_USER_ID;

  return (
    <div className="relative rounded-xl border border-gray-200 bg-white overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group">
      {isOwner && (
        <span className="absolute top-1.5 left-1.5 z-10 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-violet-700 text-white shadow-sm">
          Yours
        </span>
      )}

      {/* Client island — only the heart button is hydrated */}
      <CardFavoriteButton
        initialFavorited={initialFavorited}
        onFavoriteChange={onFavoriteChange}
        size="mini"
        isOwner={isOwner}
      />

      <Link href={`/sublet/${sublet.id}`} className="block">
        {sublet.featuredImage ? (
          <img
            src={sublet.featuredImage}
            alt={sublet.title}
            className="w-full h-28 object-cover"
          />
        ) : (
          <div
            className="w-full h-28"
            style={{ backgroundColor: `hsl(${sublet.imageHue} 60% 85%)` }}
          />
        )}

        <div className="px-3 py-2.5">
          <p className="text-sm font-semibold text-gray-900 truncate leading-snug">
            {sublet.title}
          </p>
          <p className="text-sm font-bold text-violet-800 mt-1">
            ${sublet.price.toLocaleString()}
            <span className="text-xs font-normal text-gray-400">/mo</span>
          </p>
        </div>
      </Link>
    </div>
  );
}
