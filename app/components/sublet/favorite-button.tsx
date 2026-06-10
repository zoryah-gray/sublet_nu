'use client';

import { useState } from 'react';
import { HeartIcon } from '@heroicons/react/24/outline';
import { HeartIcon as HeartSolid } from '@heroicons/react/24/solid';

export default function FavoriteButton({ initialFavorited = false }: { initialFavorited?: boolean }) {
  const [favorited, setFavorited] = useState(initialFavorited);
  return (
    <button
      onClick={() => setFavorited((f) => !f)}
      aria-label={favorited ? 'Remove from favorites' : 'Save to favorites'}
      className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition-colors"
    >
      {favorited ? (
        <HeartSolid className="w-4 h-4 text-red-500" />
      ) : (
        <HeartIcon className="w-4 h-4 text-gray-400" />
      )}
      {favorited ? 'Saved' : 'Save'}
    </button>
  );
}
