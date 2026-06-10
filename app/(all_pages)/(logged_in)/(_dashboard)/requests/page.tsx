import {
  MOCK_MATCH_REQUESTS,
  MOCK_SUBLETS,
  MOCK_USER_PROFILES,
  CURRENT_USER_ID,
} from '@/app/lib/mock-data';
import ReceivedRequestsTable from '@/app/components/dashboard/received-requests-table';
import SentRequestsTable, { type SentRequestRow } from '@/app/components/dashboard/sent-requests-table';

/** Full-page hub for all match activity — received requests (as owner) and sent applications (as renter). */
export default function RequestsPage() {
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
      <div className="mb-1">
        <h1 className="text-2xl font-bold text-gray-900">Requests & Matches</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Requests you received on your listings, and match requests you sent as a renter
        </p>
      </div>
      <div className="grid lg:grid-cols-2 gap-5 mt-6">
        <ReceivedRequestsTable requests={received} fullPage />
        <SentRequestsTable requests={sentRows} fullPage />
      </div>
    </main>
  );
}
