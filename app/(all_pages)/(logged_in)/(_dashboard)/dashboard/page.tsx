import Link from 'next/link';
import { CalendarDaysIcon, PencilSquareIcon, GlobeAltIcon, HomeIcon } from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/button';
import {
  MOCK_SUBLETS,
  MOCK_MATCH_REQUESTS,
  MOCK_USER_PROFILES,
  CURRENT_USER_ID,
} from '@/app/lib/mock-data';
import ReceivedRequestsTable from '@/app/components/dashboard/received-requests-table';
import SentRequestsTable, { type SentRequestRow } from '@/app/components/dashboard/sent-requests-table';
import FavoritesScrollCard from '@/app/components/dashboard/favorites-scroll-card';

// ─── Server-only section cards ────────────────────────────────────────────────

function SectionCard({ title, children, rightButton }: { title: string; children: React.ReactNode, rightButton?: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <div className="px-5 py-4 flex justify-between border-b border-gray-100">
        <h2 className="text-base font-semibold text-gray-900">{title}</h2>
        {rightButton}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function ProfileCard() {
  const user = MOCK_USER_PROFILES.find((p) => p.id === CURRENT_USER_ID);

  const EditProfileButton = (
      <div className="flex items-center gap-3 flex-wrap">
        <Link
          href="/dashboard/settings"
          className="flex items-center gap-1 text-xs text-violet-700 hover:text-violet-900 font-medium transition-colors"
        >
          <PencilSquareIcon className="size-3" />
          Edit Public Profile
        </Link>
      </div>
  )

  return (
    <SectionCard title="Profile" rightButton={user?.isPublic ? EditProfileButton : <></>}>
      <div className="flex items-start gap-4 flex-wrap">
        <div className="w-14 h-14 rounded-full bg-violet-100 flex items-center justify-center shrink-0">
          <span className="text-lg font-bold text-violet-800">{user?.avatarInitials ?? 'JD'}</span>
        </div>
        <div className="flex flex-col flex-1 min-w-0 gap-0.5">
          <div className="flex flex-row flex-wrap md:flex-row gap-1 items-start justify-start">
            <p className="text-base font-bold text-gray-900">{user?.name ?? 'Update Name in Settings'}</p>
            {user?.isPublic && 
              <div className="flex items-center gap-3 flex-wrap">
                <span className="flex items-center gap-1 text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded-full font-medium">
                  <GlobeAltIcon className="size-3" />
                  Public profile
                </span>
              </div>
            }
          </div>
          <p className="text-sm text-gray-500">{user?.email ?? 'Update Email in Settings'}</p>
          <div className="md:hidden flex items-center gap-1.5 text-xs text-gray-400 shrink-0">
            <CalendarDaysIcon className="size-3.5" />
            <span>Joined {user?.joinedAt ? new Date(user.joinedAt).toLocaleDateString('en-US', { month: '2-digit', year: 'numeric' }) : '09/2024'}</span>
          </div>
          

          {/* Single Column Version */}
          {/* <p className="text-base font-bold text-gray-900">{user?.name ?? 'Update Name in Settings'}</p>
          <p className="text-sm text-gray-500">{user?.email ?? 'Update Email in Settings'}</p>
          {user?.isPublic && (
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              <span className="flex items-center gap-1 text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded-full font-medium">
                <GlobeAltIcon className="size-3" />
                Public profile
              </span>
              <Link
                href="/dashboard/settings"
                className="flex items-center gap-1 text-xs text-violet-700 hover:text-violet-900 font-medium transition-colors"
              >
                <PencilSquareIcon className="size-3" />
                Edit Public Profile
              </Link>
            </div>
          )} */}
        </div>
        <div className="hidden md:flex items-center gap-1.5 text-xs text-gray-400 shrink-0">
          <CalendarDaysIcon className="size-3.5" />
          <span>Joined {user?.joinedAt ? new Date(user.joinedAt).toLocaleDateString('en-US', { month: '2-digit', year: 'numeric' }) : '09/2024'}</span>
        </div>
      </div>
    </SectionCard>
  );
}

const PREVIEW_LIMIT = 4;

function MyListingsCard() {
  const allMyListings = MOCK_SUBLETS.filter((s) => s.ownerId === CURRENT_USER_ID);
  const preview = allMyListings.slice(0, PREVIEW_LIMIT);

  const requestCounts = Object.fromEntries(
    preview.map((s) => [
      s.id,
      MOCK_MATCH_REQUESTS.filter((r) => r.subletId === s.id).length,
    ])
  );

  const seeAllListingsButton = (
    <Button
      variant="ghost"
      size="sm"
      className=" text-violet-700 hover:text-violet-900 hover:bg-violet-50"
      asChild
    >
      <Link href="/listings">
        {allMyListings.length > PREVIEW_LIMIT
          ? `View all ${allMyListings.length} listings →`
          : 'Manage all →'}
      </Link>
    </Button>
  )

  return (
    <SectionCard title="My Listings" rightButton={preview.length === 0 ? <></> : seeAllListingsButton}>
      {preview.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 gap-2 text-gray-400">
          <p className="text-sm">No listings yet.</p>
          <Button variant="outline" size="sm" className="mt-1" asChild>
            <Link href="/listings/new">Add a listing</Link>
          </Button>
        </div>
      ) : (
        <>
          <div className="space-y-4">
            {preview.map((s) => {
              const count = requestCounts[s.id] ?? 0;
              return (
                <div key={s.id} className="flex gap-3 items-start">
                  {s.featuredImage ? (
                    <img
                      src={s.featuredImage}
                      alt={s.title}
                      className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl shrink-0 object-cover"
                    />
                  ) : (
                     <div
                        className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl shrink-0 flex items-center justify-center"
                        style={{ background: `hsl(${s.imageHue} 60% 85%)` }}
                      >
                        <HomeIcon
                          className="size-7 dark:text-neutral-600"
                          style={{ color: `hsl(${s.imageHue} 50% 50%)` }}
                        />
                      </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{s.title}</p>
                    <p className="text-xs text-gray-500 truncate">{s.address}</p>
                    <p className="text-xs font-medium text-violet-700 mt-0.5">
                      ${s.price.toLocaleString()}/mo
                    </p>
                    <div className="flex gap-1.5 mt-2 flex-wrap">
                      <Button variant="outline" size="xs" className="gap-1" asChild>
                        <Link href="/listings">
                          {count > 0 ? `${count} Request${count !== 1 ? 's' : ''}` : 'Requests'}
                        </Link>
                      </Button>
                      <Button variant="outline" size="xs" className="gap-1" asChild>
                        <Link href={`/listings/${s.id}/edit`}>
                          <PencilSquareIcon className="size-3" />
                          Edit
                        </Link>
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* <div className="mt-4 pt-4 border-t border-gray-100">
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-violet-700 hover:text-violet-900 hover:bg-violet-50"
              asChild
            >
              <Link href="/listings">
                {allMyListings.length > PREVIEW_LIMIT
                  ? `View all ${allMyListings.length} listings →`
                  : 'Manage all →'}
              </Link>
            </Button>
          </div> */}
        </>
      )}
    </SectionCard>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const received = MOCK_MATCH_REQUESTS.filter((r) => r.ownerId === CURRENT_USER_ID);

  const sent = MOCK_MATCH_REQUESTS.filter((r) => r.requesterId === CURRENT_USER_ID);
  const sentRows: SentRequestRow[] = sent.map((r) => {
    const sublet = MOCK_SUBLETS.find((s) => s.id === r.subletId);
    const owner = MOCK_USER_PROFILES.find((p) => p.id === r.ownerId);
    return {
      ...r,
      price: sublet?.price ?? 0,
      ownerName: owner?.name ?? 'Unknown',
      isOwnerPublic: owner?.isPublic ?? false,
    };
  });

  return (
    <main className="flex-1 overflow-y-auto p-6 space-y-5">
      <ProfileCard />
      <MyListingsCard />
      <ReceivedRequestsTable requests={received} />
      <SentRequestsTable requests={sentRows} />
      <FavoritesScrollCard />
    </main>
  );
}
