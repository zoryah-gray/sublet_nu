import Link from 'next/link';
import { MagnifyingGlassIcon, StarIcon } from '@heroicons/react/24/outline';
import AppPreview from '@/app/components/app-preview';


const HOW_IT_WORKS = [
  {
    n: 1,
    title: 'Leaving for the quarter?',
    body: 'List your place in minutes — just set dates, price, and description.',
  },
  {
    n: 2,
    title: "Don't overpay for housing",
    body: 'Find affordable short-term rentals from fellow Northwestern students.',
  },
  {
    n: 3,
    title: 'No more Facebook scrolling',
    body: 'Stop hunting through group chats and unverified posts. Everything is in one place.',
  },
  {
    n: 4,
    title: 'SubletNU to the rescue',
    body: 'A trusted marketplace built for Northwestern students, by Northwestern students.',
  },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-white font-sans">
      {/* ─── Navbar ─── */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <span className="text-xl font-bold text-violet-800 tracking-tight">SubletNU</span>
          <nav className="hidden md:flex items-center gap-6 text-sm text-gray-600">
            <Link href="/browse" className="hover:text-violet-800 transition-colors">
              Browse
            </Link>
            <a href="#how-it-works" className="hover:text-violet-800 transition-colors">
              How it Works
            </a>
            <a href="#why" className="hover:text-violet-800 transition-colors">
              Why SubletNU
            </a>
          </nav>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="hidden sm:block text-sm text-gray-600 hover:text-violet-800 transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/browse"
              className="text-sm font-medium bg-violet-800 text-white px-4 py-2 rounded-lg hover:bg-violet-900 transition-colors"
            >
              Browse Listings
            </Link>
          </div>
        </div>
      </header>

      {/* ─── Hero ─── */}
      <section className="max-w-6xl mx-auto px-6 pt-16 pb-12">
        <div className="text-center mb-10">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-violet-800 bg-violet-50 px-3 py-1 rounded-full mb-4">
            <StarIcon className="w-3.5 h-3.5" />
            Northwestern&apos;s housing marketplace
          </span>
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 leading-tight mb-4">
            Find your perfect{' '}
            <span className="text-violet-800">Northwestern sublet</span>
          </h1>
          <p className="text-lg text-gray-500 max-w-xl mx-auto">
            Browse short-term sublets listed by other Northwestern students.
            Filter by season, price, and location — then book directly.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center mt-8">
            <Link
              href="/browse"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-violet-800 text-white font-semibold rounded-xl hover:bg-violet-900 transition-colors shadow-sm"
            >
              <MagnifyingGlassIcon className="w-4 h-4" />
              Browse Listings
            </Link>
            <a
              href="#why"
              className="inline-flex items-center justify-center px-6 py-3 border border-gray-200 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-colors"
            >
              Learn More
            </a>
          </div>
        </div>

        <AppPreview />
      </section>

      {/* ─── How It Works ─── */}
      <section id="how-it-works" className="bg-gray-900 py-16 px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-white text-center mb-2">
            Subletting Made Easy
          </h2>
          <p className="text-gray-400 text-center mb-10">
            The whole process — simplified for Northwestern students.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {HOW_IT_WORKS.map(({ n, title, body }) => (
              <div
                key={n}
                className="bg-gray-800 rounded-2xl p-6 border border-gray-700 hover:border-violet-600 transition-colors"
              >
                <div className="flex items-center gap-3 mb-3">
                  <span className="w-8 h-8 rounded-full bg-violet-800 text-white text-sm font-bold flex items-center justify-center shrink-0">
                    {n}
                  </span>
                  <p className="font-semibold text-white">{title}</p>
                </div>
                <p className="text-gray-400 text-sm leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Why SubletNU ─── */}
      <section id="why" className="py-16 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-4">Why SubletNU?</h2>
              <p className="text-gray-500 leading-relaxed mb-4">
                Finding short-term housing as a Northwestern student has always been a pain —
                scattered Facebook posts, unverified listings, and no central place to search.
              </p>
              <p className="text-gray-500 leading-relaxed mb-8">
                SubletNU is built specifically for the Northwestern community. Every listing is
                from a fellow Wildcat, so you know who you&apos;re renting from. Filter by
                quarter, set your price range, and connect directly with the lister.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <a
                  href="#how-it-works"
                  className="inline-flex items-center justify-center px-5 py-2.5 border border-gray-200 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-colors text-sm"
                >
                  Learn More
                </a>
                <Link
                  href="/browse"
                  className="inline-flex items-center justify-center px-5 py-2.5 bg-violet-800 text-white font-semibold rounded-xl hover:bg-violet-900 transition-colors text-sm"
                >
                  Browse Listings
                </Link>
              </div>
            </div>

            {/* Room photo placeholder */}
            <div className="rounded-2xl overflow-hidden h-72 md:h-80 bg-linear-to-br from-violet-50 via-violet-200 to-violet-300 flex items-center justify-center border border-violet-200">
              <div className="text-center">
                <div className="w-20 h-20 rounded-2xl bg-violet-300 flex items-center justify-center mx-auto mb-3">
                  <svg
                    className="w-10 h-10 text-violet-600"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.2}
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75"
                    />
                  </svg>
                </div>
                <p className="text-violet-500 text-sm font-medium">Your next home away from home</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="border-t border-gray-100 py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-400">
          <span className="font-semibold text-violet-800">SubletNU</span>
          <span>© 2026 SubletNU. Built for Wildcats, by Wildcats.</span>
          <div className="flex gap-4">
            <a href="#" className="hover:text-gray-600 transition-colors">Privacy</a>
            <a href="#" className="hover:text-gray-600 transition-colors">Terms</a>
            <a href="#" className="hover:text-gray-600 transition-colors">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
