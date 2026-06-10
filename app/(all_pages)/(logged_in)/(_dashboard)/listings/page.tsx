import Link from 'next/link';
import { PlusIcon } from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/button';
import { MOCK_SUBLETS, MOCK_MATCH_REQUESTS, CURRENT_USER_ID } from '@/app/lib/mock-data';
import ListingCard from '@/app/components/listings/listing-card';
import ListingsPagination from '@/app/components/listings/listings-pagination';

const LISTINGS_PER_PAGE = 3;

export default async function ListingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const created = params.created === '1';
  const updated = params.updated === '1';
  const page = Math.max(1, Number(params.page ?? 1));

  const myListings = MOCK_SUBLETS.filter((s) => s.ownerId === CURRENT_USER_ID);
  const start = (page - 1) * LISTINGS_PER_PAGE;
  const pageListings = myListings.slice(start, start + LISTINGS_PER_PAGE);

  const requestsBySublet = Object.fromEntries(
    myListings.map((s) => [
      s.id,
      MOCK_MATCH_REQUESTS.filter((r) => r.subletId === s.id),
    ]),
  );

  return (
    <main className="flex-1 overflow-y-auto p-6 space-y-5">
      {(created || updated) && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-800 font-medium">
          {created ? 'Listing published successfully.' : 'Listing updated successfully.'}
        </div>
      )}

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">
          My Listings{' '}
          <span className="text-gray-400 font-normal text-base">({myListings.length})</span>
        </h1>
        <Button asChild size="sm">
          <Link href="/listings/new">
            <PlusIcon className="size-4" />
            Add listing
          </Link>
        </Button>
      </div>

      <div className="space-y-4">
        {pageListings.map((sublet) => (
          <ListingCard
            key={sublet.id}
            sublet={sublet}
            requests={requestsBySublet[sublet.id] ?? []}
          />
        ))}
      </div>

      <ListingsPagination page={page} total={myListings.length} perPage={LISTINGS_PER_PAGE} />
    </main>
  );
}
