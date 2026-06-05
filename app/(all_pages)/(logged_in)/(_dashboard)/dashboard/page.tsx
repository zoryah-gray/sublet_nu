// Server component — no 'use client'.
// Interactive sections (accept/decline, scroll carousel) are extracted to
// client islands imported below.
import Link from 'next/link';
import {
  CalendarDaysIcon,
  InboxArrowDownIcon,
  PencilSquareIcon,
} from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/button';
import {
  MOCK_SUBLETS,
  MOCK_MATCH_REQUESTS,
  CURRENT_USER_ID,
} from '@/app/lib/mock-data';
import MatchRequestsCard from '@/app/components/dashboard/match-requests-card';
import FavoritesScrollCard from '@/app/components/dashboard/favorites-scroll-card';

// ─── Server-only section cards ────────────────────────────────────────────────

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100">
        <h2 className="text-base font-semibold text-gray-900">{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function ProfileCard() {
  return (
    <SectionCard title="Profile">
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-violet-100 flex items-center justify-center shrink-0">
          <span className="text-lg font-bold text-violet-800">JD</span>
        </div>
        <div>
          <p className="text-base font-bold text-gray-900">Jon Doe</p>
          <p className="text-sm text-gray-500">jonodono@gmail.com</p>
        </div>
        <div className="ml-auto flex items-center gap-1.5 text-xs text-gray-400">
          <CalendarDaysIcon className="size-3.5" />
          <span>Joined 09/2024</span>
        </div>
      </div>
    </SectionCard>
  );
}

const PREVIEW_LIMIT = 4;

function MyListingsCard() {
  const allMyListings = MOCK_SUBLETS.filter((s) => s.ownerId === CURRENT_USER_ID);
  const preview = allMyListings.slice(0, PREVIEW_LIMIT);
  const hasMore = allMyListings.length > PREVIEW_LIMIT;

  const requestCounts = Object.fromEntries(
    preview.map((s) => [
      s.id,
      MOCK_MATCH_REQUESTS.filter((r) => r.subletId === s.id).length,
    ]),
  );

  return (
    <SectionCard title="My Listings">
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
                      className="w-16 h-16 rounded-xl shrink-0 object-cover"
                    />
                  ) : (
                    <div
                      className="w-16 h-16 rounded-xl shrink-0"
                      style={{ background: `hsl(${s.imageHue} 60% 85%)` }}
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{s.title}</p>
                    <p className="text-xs text-gray-500 truncate">{s.address}</p>
                    <p className="text-xs font-medium text-violet-700 mt-0.5">
                      ${s.price.toLocaleString()}/mo
                    </p>
                    <div className="flex gap-1.5 mt-2">
                      <Button variant="outline" size="xs" className="gap-1" asChild>
                        <Link href="/listings">
                          <InboxArrowDownIcon className="size-3" />
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

          {hasMore && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-violet-700 hover:text-violet-900 hover:bg-violet-50"
                asChild
              >
                <Link href="/listings">
                  View all {allMyListings.length} listings →
                </Link>
              </Button>
            </div>
          )}
        </>
      )}
    </SectionCard>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  return (
    <main className="flex-1 overflow-y-auto p-6 space-y-5">
      <ProfileCard />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <MyListingsCard />
        <MatchRequestsCard />
      </div>

      <FavoritesScrollCard />
    </main>
  );
}
