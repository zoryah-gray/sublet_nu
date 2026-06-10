import { notFound } from 'next/navigation';
import Link from 'next/link';
import { CalendarDaysIcon, GlobeAltIcon, PencilSquareIcon } from '@heroicons/react/24/outline';
import { MOCK_USER_PROFILES, MOCK_SUBLETS, CURRENT_USER_ID } from '@/app/lib/mock-data';
import BackButton from '@/app/components/sublet/back-button';
import SubletCard from '@/app/components/sublet/sublet-card';

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const profile = MOCK_USER_PROFILES.find((p) => p.id === userId);

  if (!profile) notFound();

  const isOwnProfile = userId === CURRENT_USER_ID;

  if (!profile.isPublic && !isOwnProfile) {
    return (
      <div className="flex-1 overflow-y-auto bg-gray-50">
        <div className="max-w-2xl mx-auto px-4 py-8 space-y-4">
          <BackButton />
          <div className="bg-white rounded-2xl border border-gray-200 p-10 flex flex-col items-center gap-3 text-center">
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
              <span className="text-xl font-bold text-gray-400">{profile.avatarInitials}</span>
            </div>
            <p className="text-base font-semibold text-gray-700">This profile is private</p>
            <p className="text-sm text-gray-400">
              {profile.name} hasn't made their profile public.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const listings = MOCK_SUBLETS.filter(
    (s) => s.ownerId === userId && s.status === 'active',
  );

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <BackButton />

        {/* Profile header */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 rounded-full bg-violet-100 flex items-center justify-center shrink-0">
                <span className="text-xl font-bold text-violet-800">{profile.avatarInitials}</span>
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl font-bold text-gray-900">{profile.name}</h1>
                  {profile.isPublic && (
                    <span className="flex items-center gap-1 text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded-full font-medium">
                      <GlobeAltIcon className="size-3" />
                      Public
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-500 mt-0.5">{profile.email}</p>
                <div className="flex items-center gap-1.5 text-xs text-gray-400 mt-1">
                  <CalendarDaysIcon className="size-3.5" />
                  <span>
                    Joined{' '}
                    {new Date(profile.joinedAt).toLocaleDateString('en-US', {
                      month: 'long',
                      year: 'numeric',
                    })}
                  </span>
                </div>
              </div>
            </div>

            {isOwnProfile && (
              <Link
                href="/dashboard/settings"
                className="flex items-center gap-1 text-xs text-violet-700 hover:text-violet-900 font-medium transition-colors shrink-0"
              >
                <PencilSquareIcon className="size-3.5" />
                Edit profile
              </Link>
            )}
          </div>

          {profile.bio && (
            <p className="mt-5 pt-4 border-t border-gray-100 text-sm text-gray-600 leading-relaxed">
              {profile.bio}
            </p>
          )}
        </div>

        {/* Active listings */}
        <div>
          <h2 className="text-base font-semibold text-gray-900 mb-3">
            Active Listings
            {listings.length > 0 && (
              <span className="text-gray-400 font-normal text-sm ml-2">({listings.length})</span>
            )}
          </h2>
          {listings.length === 0 ? (
            <p className="text-sm text-gray-400">No active listings.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {listings.map((sublet) => (
                <SubletCard key={sublet.id} sublet={sublet} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
