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

// ─── Dashboard Skeletons ──────────────────────────────────────────────────────

function SkeletonBlock({ className }: { className?: string }) {
  return <div className={`rounded-md bg-gray-100 ${className ?? ''}`} />;
}

export function ProfileSkeleton() {
  return (
    <div className={`${shimmer} relative overflow-hidden bg-white rounded-2xl border border-gray-200 p-5`}>
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-gray-100 shrink-0" />
        <div className="space-y-2 flex-1">
          <SkeletonBlock className="h-4 w-32" />
          <SkeletonBlock className="h-3 w-48" />
        </div>
        <SkeletonBlock className="h-3 w-24" />
      </div>
    </div>
  );
}

export function ListingsSkeleton() {
  return (
    <div className={`${shimmer} relative overflow-hidden bg-white rounded-2xl border border-gray-200`}>
      <div className="px-5 py-4 border-b border-gray-100">
        <SkeletonBlock className="h-4 w-24" />
      </div>
      <div className="p-5 space-y-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="flex gap-3">
            <div className="w-16 h-16 rounded-xl bg-gray-100 shrink-0" />
            <div className="flex-1 space-y-2">
              <SkeletonBlock className="h-3.5 w-3/4" />
              <SkeletonBlock className="h-3 w-full" />
              <SkeletonBlock className="h-3 w-16" />
              <div className="flex gap-1.5 pt-1">
                <SkeletonBlock className="h-6 w-20" />
                <SkeletonBlock className="h-6 w-16" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function MatchRequestsSkeleton() {
  return (
    <div className={`${shimmer} relative overflow-hidden bg-white rounded-2xl border border-gray-200`}>
      <div className="px-5 py-4 border-b border-gray-100">
        <SkeletonBlock className="h-4 w-32" />
      </div>
      <div className="p-5 space-y-3">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 py-1">
            <SkeletonBlock className="h-5 w-16 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <SkeletonBlock className="h-3 w-40" />
              <SkeletonBlock className="h-3 w-24" />
            </div>
            <div className="flex gap-1.5">
              <SkeletonBlock className="h-6 w-16" />
              <SkeletonBlock className="h-6 w-16" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function FavoritesSkeleton() {
  return (
    <div className={`${shimmer} relative overflow-hidden bg-white rounded-2xl border border-gray-200`}>
      <div className="px-5 py-4 border-b border-gray-100">
        <SkeletonBlock className="h-4 w-20" />
      </div>
      <div className="p-5 flex flex-col items-center gap-3 py-10">
        <div className="w-8 h-8 rounded-full bg-gray-100" />
        <SkeletonBlock className="h-3 w-36" />
        <SkeletonBlock className="h-7 w-28 mt-2" />
      </div>
    </div>
  );
}

export function IncomingRequestsSkeleton() {
  return (
    <div className={`${shimmer} relative overflow-hidden bg-white rounded-2xl border border-gray-200`}>
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <SkeletonBlock className="h-4 w-36" />
        <SkeletonBlock className="h-3 w-12" />
      </div>
      <div className="divide-y divide-gray-100">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="px-5 py-3.5 flex items-start gap-3">
            <div className="size-8 rounded-full bg-gray-100 shrink-0" />
            <div className="flex-1 space-y-1.5">
              <SkeletonBlock className="h-3.5 w-32" />
              <SkeletonBlock className="h-3 w-44" />
              <SkeletonBlock className="h-3 w-56" />
              <SkeletonBlock className="h-3 w-16" />
            </div>
            <div className="flex gap-1.5 shrink-0">
              <SkeletonBlock className="h-6 w-16" />
              <SkeletonBlock className="h-6 w-16" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function MyApplicationsSkeleton() {
  return (
    <div className={`${shimmer} relative overflow-hidden bg-white rounded-2xl border border-gray-200`}>
      <div className="px-5 py-4 border-b border-gray-100">
        <SkeletonBlock className="h-4 w-32" />
      </div>
      <div className="divide-y divide-gray-100">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="px-5 py-3.5 flex items-start gap-3">
            <div className="flex-1 space-y-1.5">
              <div className="flex gap-2">
                <SkeletonBlock className="h-3.5 w-40" />
                <SkeletonBlock className="h-5 w-16 rounded-full" />
              </div>
              <SkeletonBlock className="h-3 w-28" />
              <SkeletonBlock className="h-3 w-16" />
            </div>
            <SkeletonBlock className="h-6 w-20 shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function InTalksSkeleton() {
  return (
    <div className={`${shimmer} relative overflow-hidden bg-white rounded-2xl border border-gray-200`}>
      <div className="px-5 py-4 border-b border-gray-100">
        <SkeletonBlock className="h-4 w-20" />
      </div>
      <div className="divide-y divide-gray-100">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="px-5 py-3.5 flex items-center gap-3">
            <div className="size-8 rounded-full bg-gray-100 shrink-0" />
            <div className="flex-1 space-y-1.5">
              <SkeletonBlock className="h-3.5 w-28" />
              <SkeletonBlock className="h-3 w-44" />
            </div>
            <div className="flex gap-1.5 shrink-0">
              <SkeletonBlock className="h-6 w-32" />
              <SkeletonBlock className="h-6 w-28" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function RequestsTableSkeleton() {
  return (
    <div className={`${shimmer} relative overflow-hidden bg-white rounded-2xl border border-gray-200`}>
      <div className="px-5 py-4 border-b border-gray-100 space-y-1">
        <SkeletonBlock className="h-4 w-52" />
        <SkeletonBlock className="h-3 w-40" />
      </div>
      <div className="px-5 pt-3">
        <SkeletonBlock className="h-9 w-full rounded-lg" />
      </div>
      <div className="divide-y divide-gray-100 mt-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="px-5 py-3.5 space-y-1.5">
            <div className="flex gap-2">
              <SkeletonBlock className="h-3.5 w-40" />
              <SkeletonBlock className="h-5 w-16 rounded-full" />
            </div>
            <SkeletonBlock className="h-3 w-32" />
            <SkeletonBlock className="h-3 w-20" />
            <div className="flex gap-1.5 pt-1">
              <SkeletonBlock className="h-6 w-28" />
              <SkeletonBlock className="h-6 w-20" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function MatchesListSkeleton() {
  return (
    <div className={`${shimmer} relative overflow-hidden bg-white rounded-2xl border border-gray-200`}>
      <div className="divide-y divide-gray-100">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-5 py-3.5">
            <div className="size-8 rounded-full bg-gray-100 shrink-0" />
            <div className="flex-1 space-y-1.5">
              <SkeletonBlock className="h-3.5 w-40" />
              <SkeletonBlock className="h-3 w-24" />
            </div>
            <SkeletonBlock className="h-5 w-16 rounded-full shrink-0" />
            <SkeletonBlock className="h-3 w-28 shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function MatchesPageSkeleton() {
  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <div className="h-15 border-b border-gray-200 bg-white flex items-center justify-between px-4 shrink-0">
        <div className="h-8 w-8 rounded-lg bg-gray-100" />
        <div className="h-6 w-28 rounded-md bg-gray-100" />
        <div className="flex gap-2">
          <div className="h-8 w-8 rounded-lg bg-gray-100" />
          <div className="h-8 w-8 rounded-full bg-gray-100" />
        </div>
      </div>
      <div className="flex flex-1 overflow-hidden">
        <div className="w-56 border-r border-gray-200 bg-white shrink-0 p-2 space-y-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-10 rounded-xl bg-gray-100" />
          ))}
        </div>
        <div className="flex-1 p-6 space-y-5 overflow-y-auto">
          <div className="h-7 w-24 rounded-md bg-gray-100" />
          <div className="h-11 w-full rounded-xl bg-gray-100" />
          <MatchesListSkeleton />
        </div>
      </div>
    </div>
  );
}

export function DashboardPageSkeleton() {
  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Navbar */}
      <div className="h-15 border-b border-gray-200 bg-white flex items-center justify-between px-4 shrink-0">
        <div className="h-8 w-8 rounded-lg bg-gray-100" />
        <div className="h-6 w-28 rounded-md bg-gray-100" />
        <div className="flex gap-2">
          <div className="h-8 w-8 rounded-lg bg-gray-100" />
          <div className="h-8 w-8 rounded-full bg-gray-100" />
        </div>
      </div>
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div className="w-56 border-r border-gray-200 bg-white shrink-0 p-2 space-y-1">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-10 rounded-xl bg-gray-100" />
          ))}
        </div>
        {/* Content */}
        <div className="flex-1 p-6 space-y-5 overflow-y-auto">
          <ProfileSkeleton />
          <ListingsSkeleton />
          <RequestsTableSkeleton />
          <RequestsTableSkeleton />
          <FavoritesSkeleton />
        </div>
      </div>
    </div>
  );
}

// ─── Messages Skeletons ───────────────────────────────────────────────────────

export function ThreadListSkeleton() {
  return (
    <div className={`${shimmer} relative overflow-hidden h-full`}>
      <div className="p-4 space-y-2">
        <SkeletonBlock className="h-8 w-full rounded-xl" />
      </div>
      <div className="divide-y divide-gray-100">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="flex gap-3 px-4 py-3 items-start">
            <div className="w-9 h-9 rounded-full bg-gray-100 shrink-0 mt-0.5" />
            <div className="flex-1 space-y-1.5">
              <div className="flex justify-between">
                <SkeletonBlock className="h-3 w-24" />
                <SkeletonBlock className="h-3 w-12" />
              </div>
              <SkeletonBlock className="h-3 w-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ConversationSkeleton() {
  return (
    <div className={`${shimmer} relative overflow-hidden h-full flex flex-col`}>
      {/* Header */}
      <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-gray-100 shrink-0" />
        <div className="space-y-1.5 flex-1">
          <SkeletonBlock className="h-3.5 w-28" />
          <SkeletonBlock className="h-3 w-44" />
        </div>
        <SkeletonBlock className="h-7 w-24" />
      </div>
      {/* Messages */}
      <div className="flex-1 p-5 space-y-4">
        {[false, true, false, true, false].map((fromMe, i) => (
          <div key={i} className={`flex ${fromMe ? 'justify-end' : 'justify-start'}`}>
            <SkeletonBlock className={`h-10 rounded-2xl ${fromMe ? 'w-48' : 'w-56'}`} />
          </div>
        ))}
      </div>
      {/* Input */}
      <div className="px-4 py-3 border-t border-gray-100 flex gap-2">
        <SkeletonBlock className="h-9 flex-1 rounded-xl" />
        <SkeletonBlock className="h-9 w-16 rounded-xl" />
      </div>
    </div>
  );
}

export function MessagesPageSkeleton() {
  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Navbar */}
      <div className="h-15 border-b border-gray-200 bg-white flex items-center justify-between px-4 shrink-0">
        <div className="h-8 w-8 rounded-lg bg-gray-100" />
        <div className="h-6 w-28 rounded-md bg-gray-100" />
        <div className="flex gap-2">
          <div className="h-8 w-8 rounded-lg bg-gray-100" />
          <div className="h-8 w-8 rounded-full bg-gray-100" />
        </div>
      </div>
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div className="w-56 border-r border-gray-200 bg-white shrink-0 p-2 space-y-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-10 rounded-xl bg-gray-100" />
          ))}
        </div>
        {/* Thread list */}
        <div className="w-80 border-r border-gray-200 bg-white shrink-0">
          <ThreadListSkeleton />
        </div>
        {/* Conversation */}
        <div className="flex-1">
          <ConversationSkeleton />
        </div>
      </div>
    </div>
  );
}

export function RequestsPageSkeleton() {
  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <div className="h-15 border-b border-gray-200 bg-white flex items-center justify-between px-4 shrink-0">
        <div className="h-8 w-8 rounded-lg bg-gray-100" />
        <div className="h-6 w-28 rounded-md bg-gray-100" />
        <div className="flex gap-2">
          <div className="h-8 w-8 rounded-lg bg-gray-100" />
          <div className="h-8 w-8 rounded-full bg-gray-100" />
        </div>
      </div>
      <div className="flex flex-1 overflow-hidden">
        <div className="w-56 border-r border-gray-200 bg-white shrink-0 p-2 space-y-1">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-10 rounded-xl bg-gray-100" />
          ))}
        </div>
        <div className="flex-1 p-6 space-y-5 overflow-y-auto">
          <div className="space-y-1.5">
            <SkeletonBlock className="h-7 w-52" />
            <SkeletonBlock className="h-3.5 w-80" />
          </div>
          <div className="grid lg:grid-cols-2 gap-5 mt-6">
            <RequestsTableSkeleton />
            <RequestsTableSkeleton />
          </div>
        </div>
      </div>
    </div>
  );
}

export function PublicProfilePageSkeleton() {
  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <div className="h-15 border-b border-gray-200 bg-white flex items-center justify-between px-4 shrink-0">
        <div className="h-8 w-8 rounded-lg bg-gray-100" />
        <div className="h-6 w-28 rounded-md bg-gray-100" />
        <div className="flex gap-2">
          <div className="h-8 w-8 rounded-lg bg-gray-100" />
          <div className="h-8 w-8 rounded-full bg-gray-100" />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
          {/* Back button placeholder */}
          <SkeletonBlock className="h-5 w-14" />

          {/* Profile header card */}
          <div className={`${shimmer} relative overflow-hidden bg-white rounded-2xl border border-gray-200 p-6`}>
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 rounded-full bg-gray-100 shrink-0" />
              <div className="flex-1 space-y-2 pt-1">
                <SkeletonBlock className="h-5 w-40" />
                <SkeletonBlock className="h-3.5 w-56" />
                <SkeletonBlock className="h-3 w-32" />
              </div>
            </div>
            <div className="mt-5 pt-4 border-t border-gray-100 space-y-2">
              <SkeletonBlock className="h-3 w-full" />
              <SkeletonBlock className="h-3 w-3/4" />
            </div>
          </div>

          {/* Active listings section */}
          <div className="space-y-3">
            <SkeletonBlock className="h-5 w-36" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <SubletCardSkeleton />
              <SubletCardSkeleton />
            </div>
          </div>
        </div>
      </div>
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
        <div className="hidden lg:block w-72 border-r border-gray-200 bg-white p-4 space-y-5 shrink-0">
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
        <div className="hidden lg:block w-80 xl:w-96 border-l border-gray-200 bg-gray-50 shrink-0" />
      </div>
    </div>
  );
}
