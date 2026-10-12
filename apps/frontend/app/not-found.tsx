import Link from 'next/link';
import { MapPinIcon } from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/button';

// Root not-found boundary. Next renders it for every unmatched URL and for any
// notFound() call that has no closer not-found.tsx (sublet/[id], listings/[id]/edit).
// The copy deliberately doesn't distinguish "doesn't exist" from "not yours",
// so a 404 never confirms that someone else's listing id is real.
export default function NotFound() {
  return (
    <main className="flex-1 flex items-center justify-center px-4 py-16">
      <div className="max-w-md w-full text-center flex flex-col items-center gap-3">
        <div className="size-14 rounded-2xl bg-violet-100 flex items-center justify-center">
          <MapPinIcon className="size-7 text-violet-700" />
        </div>
        <p className="text-sm font-semibold text-violet-700">404</p>
        <h1 className="text-2xl font-bold text-gray-900">We couldn't find that page</h1>
        <p className="text-sm text-gray-500">
          The link may be broken, or the listing may have been removed or isn't available to you.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2 mt-3">
          <Button className="bg-violet-700 hover:bg-violet-800" asChild>
            <Link href="/browse">Browse listings</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/">Go home</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
