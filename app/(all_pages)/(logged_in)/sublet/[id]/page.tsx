import { notFound } from 'next/navigation';
import { MapPinIcon, HomeIcon, CalendarDaysIcon, BoltIcon, UsersIcon } from '@heroicons/react/24/outline';
import { BedDouble, Bath } from 'lucide-react';
import { MOCK_SUBLETS, MOCK_USER_PROFILES, CURRENT_USER_ID } from '@/app/lib/mock-data';
import BackButton from '@/app/components/sublet/back-button';
import FavoriteButton from '@/app/components/sublet/favorite-button';
import OwnerControls from '@/app/components/sublet/owner-controls';
import RequestMatchModal from '@/app/components/sublet/request-match-modal';
import ImageGallery from '@/app/components/sublet/image-gallery';

const QUARTER_COLORS: Record<string, string> = {
  Fall:   'bg-amber-50 text-amber-700 border-amber-200',
  Winter: 'bg-sky-50 text-sky-700 border-sky-200',
  Spring: 'bg-green-50 text-green-700 border-green-200',
  Summer: 'bg-orange-50 text-orange-700 border-orange-200',
};

export default async function SubletDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const sublet = MOCK_SUBLETS.find((s) => s.id === id);
  if (!sublet) notFound();

  const isOwner = sublet.ownerId === CURRENT_USER_ID;
  const owner = MOCK_USER_PROFILES.find((p) => p.id === sublet.ownerId);
  const ownerName = owner?.name ?? 'the owner';

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto w-full px-4 py-6 space-y-6">
        {/* Back row + action button */}
        <div className="flex items-center justify-between gap-3">
          <BackButton />
          {isOwner ? (
            <OwnerControls subletId={sublet.id} subletTitle={sublet.title} />
          ) : (
            <FavoriteButton />
          )}
        </div>

        {/* Hero gallery */}
        {sublet.images && sublet.images.length > 0 ? (
          <ImageGallery images={sublet.images} title={sublet.title} />
        ) : (
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
        )}

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
            <p className="text-2xl font-bold text-violet-800">${sublet.price.toLocaleString()}</p>
            <p className="text-xs text-gray-400">per month</p>
          </div>
        </div>

        {/* Description */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-2">
          <p className="text-sm font-semibold text-gray-700">About this place</p>
          <p className="text-sm text-gray-600 leading-relaxed">{sublet.description}</p>
        </div>
        
        {/* Availability */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
          <p className="text-sm font-semibold text-gray-700">Availability</p>
          <div className="flex items-center gap-2 text-sm text-gray-700">
            <CalendarDaysIcon className="w-4 h-4 text-gray-400" />
            <span>{sublet.startDate} — {sublet.endDate}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {sublet.quarters.map((q) => (
              <span key={q} className={`text-sm px-3 py-1 rounded-full border font-medium ${QUARTER_COLORS[q]}`}>
                {q}
              </span>
            ))}
          </div>
        </div>

        {/* Details Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
            <BedDouble className="size-5 text-gray-400 shrink-0" />
            <div>
              <p className="text-lg font-bold text-gray-900">
                {sublet.beds === 0 ? 'Studio' : sublet.beds}
              </p>
              <p className="text-xs text-gray-400">Bedroom{sublet.beds !== 1 ? 's' : ''}</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
            <Bath className="size-5 text-gray-400 shrink-0" />
            <div>
              <p className="text-lg font-bold text-gray-900">{sublet.baths}</p>
              <p className="text-xs text-gray-400">Bathroom{sublet.baths !== 1 ? 's' : ''}</p>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
            <HomeIcon className="size-5 text-gray-400 shrink-0" />
            <div>
              <p className="text-lg font-semibold text-gray-900">{sublet.placeType === 'entire' ? 'Studio' : 'Private room with roommates'}</p>
              {sublet.placeType !== 'private' ? 
                <p className="text-xs text-gray-400">No roomates, entire place to yourself</p>
                : sublet.roommates != null && (
                  <div className="flex items-center gap-2 text-sm text-gray-700">
                    <UsersIcon className="size-4 text-gray-400 shrink-0" />
                    <p className='text-xs text-gray-400'>{sublet.roommates} roommate{sublet.roommates !== 1 ? 's' : ''}</p>
                  </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
            <BoltIcon className="size-5 text-gray-400 shrink-0" />
            {sublet.utilitiesIncluded != null && (
              <div>
                {sublet.utilitiesIncluded ? (
                  <p className='text-sm text-gray-900'>Utilities included</p>
                ) : (
                  <div>
                    <p className="text-lg font-bold text-gray-900">~${sublet.utilitiesCost}/mo utilities</p>
                    <p className="text-xs text-gray-400">Not included in monthly price</p>
                  </div>
                )}
              </div>
            )}
          </div>


        </div>

        {/* Condensed - Details */}
        {/* <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
          <p className="text-sm font-semibold text-gray-700">Details</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {sublet.placeType && (
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <HomeIcon className="size-4 text-gray-400 shrink-0" />
                <span>{sublet.placeType === 'entire' ? 'Entire place to yourself' : 'Private room with roommates'}</span>
              </div>
            )}
            {sublet.placeType === 'private' && sublet.roommates != null && (
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <UsersIcon className="size-4 text-gray-400 shrink-0" />
                <span>{sublet.roommates} roommate{sublet.roommates !== 1 ? 's' : ''}</span>
              </div>
            )}
            {sublet.utilitiesIncluded != null && (
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <BoltIcon className="size-4 text-gray-400 shrink-0" />
                {sublet.utilitiesIncluded ? (
                  <span>Utilities included</span>
                ) : (
                  <span>~${sublet.utilitiesCost}/mo utilities (not included in monthly price)</span>
                )}
              </div>
            )}
            {sublet.beds > 0 && (
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <BedDouble className="size-4 text-gray-400 shrink-0" />
                <span>{sublet.beds} Bedroom{sublet.beds !== 1 ? 's' : ''}</span>
              </div>
            )}
            {sublet.baths > 0 && (
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <Bath className="size-4 text-gray-400 shrink-0" />
                <span>{sublet.baths} Bathroom{sublet.baths !== 1 ? 's' : ''}</span>
              </div>
            )}
            
          </div>
        </div> */}

        {/* CTA — owner sees listing stats, non-owner sees request button */}
        {isOwner ? (
          <div className="bg-violet-50 rounded-2xl border border-violet-200 p-5 space-y-1">
            <p className="font-semibold text-gray-900 text-sm">This is your listing</p>
            <p className="text-xs text-gray-500">
              Manage requests and availability from your{' '}
              <a href="/listings" className="text-violet-700 underline underline-offset-2 hover:text-violet-900">
                Listings page
              </a>.
            </p>
          </div>
        ) : (
          <div className="bg-violet-50 rounded-2xl border border-violet-200 p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <p className="font-semibold text-gray-900 text-sm">Interested in this listing?</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Send a match request to {ownerName} to start the conversation.
              </p>
            </div>
            <div className="shrink-0 w-full sm:w-auto">
              <RequestMatchModal
                subletId={sublet.id}
                subletTitle={sublet.title}
                ownerName={ownerName}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
