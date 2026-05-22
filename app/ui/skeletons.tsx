const shimmer =
  'before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_2s_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/60 before:to-transparent';

export function SubletCardSkeleton() {
  return (
    <div
      className={`${shimmer} relative overflow-hidden rounded-xl border border-gray-200 bg-white`}
    >
      <div className="w-full h-40 bg-gray-100" />
      <div className="p-3 space-y-2">
        <div className="h-4 w-3/4 rounded-md bg-gray-100" />
        <div className="h-3 w-full rounded-md bg-gray-100" />
        <div className="flex gap-3 mt-1">
          <div className="h-3 w-10 rounded-md bg-gray-100" />
          <div className="h-3 w-10 rounded-md bg-gray-100" />
          <div className="h-3 w-14 rounded-md bg-gray-100" />
        </div>
        <div className="flex gap-1 pt-1">
          <div className="h-5 w-12 rounded-full bg-gray-100" />
          <div className="h-5 w-14 rounded-full bg-gray-100" />
        </div>
        <div className="h-5 w-20 rounded-md bg-gray-100" />
      </div>
    </div>
  );
}

export function SubletGridSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <SubletCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function BrowsePageSkeleton() {
  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Navbar skeleton */}
      <div className="h-15 border-b border-gray-200 bg-white flex items-center justify-between px-4 shrink-0">
        <div className="h-8 w-8 rounded-lg bg-gray-100" />
        <div className="h-6 w-28 rounded-md bg-gray-100" />
        <div className="h-8 w-8 rounded-full bg-gray-100" />
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar skeleton */}
        <div className="hidden lg:block w-72 border-r border-gray-200 bg-white p-4 space-y-5 flex-shrink-0">
          <div className="h-5 w-16 rounded-md bg-gray-100" />
          <div className="space-y-2">
            <div className="h-4 w-12 rounded-md bg-gray-100" />
            <div className="h-3 w-full rounded-full bg-gray-100" />
            <div className="flex gap-2 mt-2">
              <div className="h-8 w-28 rounded-lg bg-gray-100" />
              <div className="h-8 w-24 rounded-lg bg-gray-100" />
            </div>
          </div>
          <div className="space-y-2">
            <div className="h-4 w-16 rounded-md bg-gray-100" />
            <div className="flex gap-2 flex-wrap">
              {['Fall', 'Winter', 'Spring', 'Summer'].map((s) => (
                <div key={s} className="h-7 w-14 rounded-full bg-gray-100" />
              ))}
            </div>
          </div>
        </div>

        {/* Main content skeleton */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="h-10 w-full rounded-xl bg-gray-100" />
          <SubletGridSkeleton />
        </div>

        {/* Map skeleton */}
        <div className="hidden lg:block w-80 xl:w-96 border-l border-gray-200 bg-gray-50 flex-shrink-0" />
      </div>
    </div>
  );
}
