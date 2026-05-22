import Link from 'next/link';
import { MagnifyingGlassIcon, MapPinIcon, StarIcon } from '@heroicons/react/24/outline';
import { MOCK_SUBLETS } from '@/app/lib/mock-data';

const SEASON_COLORS: Record<string, string> = {
  Fall: 'bg-amber-50 text-amber-700',
  Winter: 'bg-sky-50 text-sky-700',
  Spring: 'bg-green-50 text-green-700',
  Summer: 'bg-orange-50 text-orange-700',
};

function PreviewCard({ sublet }: { sublet: (typeof MOCK_SUBLETS)[0] }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
      <div
        className="w-full h-28 flex items-center justify-center"
        style={{ backgroundColor: `hsl(${sublet.imageHue} 60% 92%)` }}
      >
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: `hsl(${sublet.imageHue} 55% 75%)` }}
        >
          <svg
            className="w-5 h-5 text-white"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75"
            />
          </svg>
        </div>
      </div>
      <div className="p-2.5">
        <p className="font-semibold text-gray-900 text-xs leading-snug truncate">
          {sublet.title}
        </p>
        <div className="flex items-center gap-0.5 mt-0.5 text-[11px] text-gray-400">
          <MapPinIcon className="w-2.5 h-2.5 shrink-0" />
          <span className="truncate">{sublet.neighborhood}</span>
        </div>
        <div className="flex items-center gap-1.5 mt-1.5 text-[11px] text-gray-500">
          <span>{sublet.beds === 0 ? 'Studio' : `${sublet.beds} bed`}</span>
          <span className="text-gray-200">·</span>
          <span>{sublet.baths} bath</span>
        </div>
        <div className="flex flex-wrap gap-1 mt-1.5">
          {sublet.seasons.slice(0, 2).map((s) => (
            <span
              key={s}
              className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${SEASON_COLORS[s]}`}
            >
              {s}
            </span>
          ))}
        </div>
        <p className="mt-1.5 font-bold text-violet-800 text-xs">
          ${sublet.price.toLocaleString()}
          <span className="text-[10px] font-normal text-gray-400">/mo</span>
        </p>
      </div>
    </div>
  );
}

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
  const previewSublets = MOCK_SUBLETS.slice(0, 4);

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
            <button className="hidden sm:block text-sm text-gray-600 hover:text-violet-800 transition-colors">
              Sign In
            </button>
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

        {/* ─── App Preview ─── */}
        <div className="rounded-2xl border border-gray-200 bg-gray-50 overflow-hidden shadow-md">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-200 bg-white">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-400" />
              <div className="w-3 h-3 rounded-full bg-yellow-400" />
              <div className="w-3 h-3 rounded-full bg-green-400" />
            </div>
            <div className="flex-1 mx-4">
              <div className="h-5 rounded-md bg-gray-100 text-xs text-gray-400 flex items-center px-3 max-w-xs mx-auto">
                subletnu.com/browse
              </div>
            </div>
          </div>

          <div className="flex gap-0 h-85">
            {/* Cards side */}
            <div className="flex-1 p-4 overflow-hidden">
              {/* Fake search bar */}
              <div className="flex items-center gap-2 mb-3">
                <div className="flex-1 flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 h-9">
                  <MagnifyingGlassIcon className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                  <span className="text-xs text-gray-400">Search Evanston sublets...</span>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  {['Sort', 'Price', 'Season'].map((f) => (
                    <span
                      key={f}
                      className="text-[11px] px-2.5 py-1 rounded-md border border-gray-200 bg-white text-gray-600 whitespace-nowrap"
                    >
                      {f} ▾
                    </span>
                  ))}
                </div>
              </div>
              {/* Cards grid */}
              <div className="grid grid-cols-2 gap-2.5">
                {previewSublets.map((s) => (
                  <PreviewCard key={s.id} sublet={s} />
                ))}
              </div>
              {/* Pagination dots */}
              <div className="flex items-center justify-center gap-1.5 mt-3">
                {[1, 2, 3].map((n) => (
                  <div
                    key={n}
                    className={`rounded-full transition-all ${n === 1 ? 'w-5 h-1.5 bg-violet-800' : 'w-1.5 h-1.5 bg-gray-300'}`}
                  />
                ))}
              </div>
            </div>

            {/* Map side */}
            <div className="hidden sm:flex w-52 md:w-64 shrink-0 border-l border-gray-200 bg-slate-100 relative items-center justify-center overflow-hidden">
              {/* Fake map grid */}
              <div className="absolute inset-0 opacity-30">
                {Array.from({ length: 8 }).map((_, row) => (
                  <div key={row} className="flex">
                    {Array.from({ length: 6 }).map((_, col) => (
                      <div
                        key={col}
                        className="border border-slate-300"
                        style={{ width: 48, height: 48 }}
                      />
                    ))}
                  </div>
                ))}
              </div>
              {/* Road lines */}
              <div className="absolute inset-0 opacity-20">
                <div className="absolute top-1/3 left-0 right-0 h-px bg-slate-400" />
                <div className="absolute top-2/3 left-0 right-0 h-px bg-slate-400" />
                <div className="absolute left-1/3 top-0 bottom-0 w-px bg-slate-400" />
                <div className="absolute left-2/3 top-0 bottom-0 w-px bg-slate-400" />
              </div>
              {/* Pin + Popup */}
              <div className="relative flex flex-col items-center z-10">
                <div className="bg-white rounded-xl shadow-lg border border-gray-200 px-3 py-2 mb-2 text-center">
                  <p className="text-[11px] font-semibold text-gray-800">Evanston, IL</p>
                  <p className="text-[10px] text-violet-800 font-medium">12 listings nearby</p>
                </div>
                <div className="w-6 h-6 bg-violet-800 rounded-full border-2 border-white shadow-md flex items-center justify-center">
                  <div className="w-2 h-2 bg-white rounded-full" />
                </div>
                <div className="w-2 h-2 bg-violet-800/30 rounded-full mt-0.5 scale-x-150" />
              </div>
            </div>
          </div>
        </div>
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
