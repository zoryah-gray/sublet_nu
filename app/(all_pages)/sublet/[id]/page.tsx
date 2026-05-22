'use client';

import { use } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ArrowLeftIcon,
  MapPinIcon,
  HomeIcon,
  CalendarDaysIcon,
  HeartIcon,
} from '@heroicons/react/24/outline';
import { HeartIcon as HeartSolid } from '@heroicons/react/24/solid';
import { useState } from 'react';
import { MOCK_SUBLETS } from '@/app/lib/mock-data';

const SEASON_COLORS: Record<string, string> = {
  Fall: 'bg-amber-50 text-amber-700 border-amber-200',
  Winter: 'bg-sky-50 text-sky-700 border-sky-200',
  Spring: 'bg-green-50 text-green-700 border-green-200',
  Summer: 'bg-orange-50 text-orange-700 border-orange-200',
};

export default function SubletDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const sublet = MOCK_SUBLETS.find((s) => s.id === id);
  const [favorited, setFavorited] = useState(false);

  if (!sublet) notFound();

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      {/* Sticky header */}
      <header className="sticky top-0 z-30 bg-white border-b border-gray-200 h-15 flex items-center justify-between px-4">
        <Link
          href="/browse"
          className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-indigo-600 transition-colors"
        >
          <ArrowLeftIcon className="w-4 h-4" />
          Back to Browse
        </Link>
        <span className="text-base font-bold text-indigo-600 tracking-tight">SubletNU</span>
        <button
          onClick={() => setFavorited((f) => !f)}
          aria-label={favorited ? 'Remove from favorites' : 'Save to favorites'}
          className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
        >
          {favorited ? (
            <HeartSolid className="w-4 h-4 text-red-500" />
          ) : (
            <HeartIcon className="w-4 h-4 text-gray-400" />
          )}
          {favorited ? 'Saved' : 'Save'}
        </button>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* Hero image placeholder */}
        <div
          className="w-full h-56 sm:h-72 rounded-2xl flex items-center justify-center"
          style={{ backgroundColor: `hsl(${sublet.imageHue} 60% 92%)` }}
        >
          <div
            className="w-20 h-20 rounded-2xl flex items-center justify-center"
            style={{ backgroundColor: `hsl(${sublet.imageHue} 55% 75%)` }}
          >
            <HomeIcon className="w-10 h-10 text-white" />
          </div>
        </div>

        {/* Title + price */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 leading-tight">{sublet.title}</h1>
            <div className="flex items-center gap-1 mt-1 text-sm text-gray-500">
              <MapPinIcon className="w-4 h-4 shrink-0" />
              <span>{sublet.address}</span>
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="text-2xl font-bold text-indigo-600">
              ${sublet.price.toLocaleString()}
            </p>
            <p className="text-xs text-gray-400">per month</p>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Bedrooms', value: sublet.beds === 0 ? 'Studio' : sublet.beds },
            { label: 'Bathrooms', value: sublet.baths },
            { label: 'Square Feet', value: sublet.sqft.toLocaleString() },
          ].map(({ label, value }) => (
            <div
              key={label}
              className="bg-white rounded-xl border border-gray-200 p-4 text-center"
            >
              <p className="text-lg font-bold text-gray-900">{value}</p>
              <p className="text-xs text-gray-400 mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Seasons */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <CalendarDaysIcon className="w-4 h-4 text-gray-400" />
            <p className="text-sm font-semibold text-gray-700">Available Seasons</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {sublet.seasons.map((s) => (
              <span
                key={s}
                className={`text-sm px-3 py-1 rounded-full border font-medium ${SEASON_COLORS[s]}`}
              >
                {s}
              </span>
            ))}
          </div>
          <p className="text-xs text-gray-400">
            {sublet.startDate} — {sublet.endDate}
          </p>
        </div>

        {/* Description */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-2">
          <p className="text-sm font-semibold text-gray-700">About this place</p>
          <p className="text-sm text-gray-600 leading-relaxed">{sublet.description}</p>
        </div>

        {/* CTA */}
        <div className="bg-indigo-50 rounded-2xl border border-indigo-100 p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <p className="font-semibold text-gray-900 text-sm">Interested in this listing?</p>
            <p className="text-xs text-gray-500 mt-0.5">
              Contact the lister to ask questions or arrange a viewing.
            </p>
          </div>
          <button className="shrink-0 px-5 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition-colors shadow-sm">
            Contact Lister
          </button>
        </div>
      </div>
    </div>
  );
}
