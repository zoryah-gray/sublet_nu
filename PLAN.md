# SubletNU — Feature & Architecture Plan

> Edit this file freely. Claude reads it at the start of relevant sessions.
> Status tags: `[ ]` not started · `[~]` in progress · `[x]` done

---

## 1. Navigation Architecture

### Decision: Separate global nav from dashboard sub-nav

The hamburger **NavSidebar** is visible on every page (including public-facing ones). It should only contain top-level destinations a casual or logged-out user needs:

| NavSidebar (hamburger)    | DashboardSidebar |
| ------------------------- | ---------------- |
| Home                      | Profile          |
| Browse                    | My Listings      |
| Dashboard _(entry point)_ | Favorites        |
|                           | Messages         |
|                           | Matches _(new)_  |
|                           | Settings         |

**Rationale:** Favorites, Messages, and Matches are account-level features. Putting them in both sidebars creates redundancy and signals the wrong information hierarchy. The hamburger nav gets you _to_ the account area; the dashboard sidebar navigates _within_ it.

**TODO:**

- `[ ]` Remove Favorites and Messages from `app/components/nav-sidebar.tsx` NAV_LINKS
- `[ ]` Add Matches to `app/components/dashboard-sidebar.tsx` NAV_LINKS (href: `/matches`)

---

## 2. Rendering Architecture

> **Sources:** [Next.js Rendering Strategies](https://medium.com/@md-lens/exploring-next-js-rendering-strategies-a-comprehensive-guide-f06cb3941f22) · [PPR in Production 2026](https://samcheek.com/blog/nextjs-partial-prerendering-production-2026) · [PPR Deep Dive](https://dev.to/pockit_tools/nextjs-partial-prerendering-ppr-deep-dive-how-it-works-when-to-use-it-and-why-it-changes-48dk) · [PPR in Next.js 16](https://www.ashishgogula.in/blogs/a-practical-guide-to-partial-prerendering-in-next-js-16) · [Next.js on AWS](https://www.sms.com/blog/next-js-on-aws/) · [SST + OpenNext](https://sst.dev/docs/start/aws/nextjs) · [Next.js PPR Platform Guide](https://nextjs.org/docs/app/guides/ppr-platform-guide)

---

### 2a. Component-Level: Server vs Client

**Default: server component unless interactivity is required.**

| Needs                                  | Use                                                   |
| -------------------------------------- | ----------------------------------------------------- |
| Display data, no events                | **Server component** — no bundle cost, zero hydration |
| `useState`, event handlers, forms      | **`'use client'`** — isolated island                  |
| Browser APIs (`window`, `router.back`) | **`'use client'`** — not available on server          |
| Context providers                      | **`'use client'`** — must wrap client tree            |

**Pattern:** `page.tsx` (server) → passes data as props → imports small `'use client'` islands for interactivity.

**Anti-patterns to avoid:**

- Adding `'use client'` to a whole page just to use `useRouter` — extract a tiny `<BackButton>` instead
- Fetching data inside a client component when a server parent could pass it as props
- Wrapping entire layouts in `'use client'` context — keep contexts narrow, push them down the tree

**Established examples in this codebase:**

```
sublet/[id]/page.tsx              ← server (async, await params)
  └─ components/sublet/back-button.tsx      ← 'use client' (router.back)
  └─ components/sublet/favorite-button.tsx  ← 'use client' (useState)

dashboard/page.tsx   ← 'use client' (accept/decline state — candidate for PPR refactor)
browse/page.tsx      ← 'use client' (filter state — candidate for PPR refactor)
messages/page.tsx    ← 'use client' (thread/send state — stays CSR)
```

---

### 2b. Page-Level: Partial Prerendering (PPR) — the primary strategy

Next.js 16 ships PPR as **stable** via `cacheComponents: true`. PPR ends the binary SSR-vs-SSG choice: a single page emits a **static shell** (built at deploy, served from CDN edge) and **dynamic holes** (streamed from origin in parallel).

The dividing line is `<Suspense>`. Everything **outside** = static. Everything **inside** = streamed.

**Enable once in `next.config.ts`:**

```ts
const nextConfig: NextConfig = {
  cacheComponents: true,
};
```

**Measured performance gains (p75 mobile):**
| Metric | Full SSR | PPR | Gain |
|---|---|---|---|
| TTFB | 300–800 ms | 20–80 ms | **4–10×** |
| LCP | 1.8–2.4 s | 0.6–1.2 s | **~3×** |
| CLS | variable | 0 (with sized skeletons) | eliminated |

---

### 2c. Per-Route Rendering Decisions

| Route                                  | Strategy                 | Notes                                                                                    |
| -------------------------------------- | ------------------------ | ---------------------------------------------------------------------------------------- |
| `/` (home)                             | **SSG**                  | Pure static marketing content                                                            |
| `/browse`                              | **PPR**                  | Shell: layout, filter sidebar structure. Holes: results, pagination, filter state        |
| `/sublet/[id]`                         | **PPR** ✓ already server | Shell: title, description, image, specs. Holes: favorite state, request/owner controls   |
| `/listings`                            | **PPR**                  | Shell: page header. Holes: listing cards with live request counts                        |
| `/listings/new`, `/listings/[id]/edit` | **CSR**                  | Multi-step form, fully interactive                                                       |
| `/dashboard`                           | **PPR**                  | Shell: section headers. Holes: each card section (profile, listings, matches, favorites) |
| `/matches`                             | **PPR**                  | Shell: tabs/header. Holes: match status cards                                            |
| `/favorites`                           | **CSR**                  | Unfavoriting mutates the list in real time                                               |
| `/messages`                            | **CSR**                  | Full real-time interaction                                                               |
| `/profile/[userId]`                    | **PPR**                  | Shell: bio, name. Holes: public listings                                                 |
| `/dashboard/settings`                  | **CSR**                  | All forms                                                                                |

---

### 2d. PPR Suspense Boundary Rules

1. **One boundary per independent concern** — split price, user-state, and recommendations separately; slow queries don't block fast ones.
2. **≤ 5–6 Suspense boundaries per route** — streaming overhead beyond this outweighs parallelism gains.
3. **Keep `searchParams` inside Suspense** — any component in the static shell that reads `searchParams` forces the entire page into SSR.
4. **Skeleton dimensions must match final content** — use `min-height` matching maximum content height. Mismatched fallbacks cause CLS > 0.1.
5. **LCP images belong in the static shell** — `next/image` in the shell generates `<link rel="preload">` in initial HTML, starting the fetch before any JS runs.

**Template for a PPR page:**

```tsx
// page.tsx — server component, no 'use client'
export default async function Page({ params }) {
  const data = await getData(params.id); // cached fetch

  return (
    <div>
      {/* Static shell — CDN, ~20ms TTFB */}
      <h1>{data.title}</h1>
      <StaticContent data={data} />
      <ClientIsland /> {/* 'use client' island, still in shell */}
      {/* Dynamic holes — streamed from origin */}
      <Suspense fallback={<SkeletonA />}>
        <DynamicSectionA id={data.id} /> {/* reads user session/cookies */}
      </Suspense>
      <Suspense fallback={<SkeletonB />}>
        <DynamicSectionB id={data.id} /> {/* independent query */}
      </Suspense>
    </div>
  );
}
```

---

### 2e. AWS Deployment Architecture

SubletNU already has AWS CDK in `backend/`. Two phases:

#### Phase 1 — MVP (no database): SST v3 + OpenNext

```
CloudFront (CDN edge, global ~20–50ms TTFB for static shells)
  ├── S3  ──────── static assets (JS, CSS, public/)
  ├── S3  ──────── Full Route Cache (PPR shells, ISR pages)
  └── Lambda ───── dynamic renderer (streamed holes, API routes)
        └── DynamoDB (ISR metadata + cache tags)
```

- SST v3 wraps OpenNext and integrates directly with existing CDK in `backend/`
- Setup: `new sst.aws.Nextjs("SubletNU", { link: [bucket] })`
- Scales to zero, minimal cost for early traffic
- Cold starts: 200–500ms on Lambda (use provisioned concurrency for `/browse` and `/sublet/[id]`)
- **Limitation:** no VPC — cannot connect to private RDS. Fine for Phase 1.

#### Phase 2 — With PostgreSQL: ECS Fargate + CloudFront via CDK

```
CloudFront (CDN edge)
  ├── S3 ───────── static assets
  └── ALB ──────── ECS Fargate (persistent Node.js container)
                     └── VPC → RDS PostgreSQL (private subnet)
                         └── ElastiCache Redis (shared ISR/PPR cache)
```

- No cold starts — persistent process, consistent response times
- VPC required for private RDS — **Amplify cannot do this**
- ECS auto-scales on CPU/memory metrics
- Cost: ~$50–100/month base (Fargate) or ~$20–40 (EC2 reserved) — cost-effective at sustained traffic
- Shared Redis required for PPR/ISR cache consistency across multiple container instances

#### Why not AWS Amplify?

Amplify cannot connect to VPC resources. Since SubletNU needs RDS, Amplify is a dead end. Avoid.

#### Migration path:

1. **Now:** SST + OpenNext (zero infra config, validates the app, cheap)
2. **When adding PostgreSQL:** migrate to ECS Fargate via CDK (`backend/`) for VPC connectivity

---

### 2f. Client Sub-Component Folder Convention

```
app/components/
  sublet/     ← back-button [x], favorite-button [x], request-match-modal [ ], owner-controls [ ]
  match/      ← accept-button [ ], confirm-sublet-button [ ], request-card [ ]
  listings/   ← archive-button [ ], delete-confirm-dialog [ ], request-inbox [ ]
  profile/    ← visibility-toggle [ ], edit-profile-form [ ]
```

---

## 3. Data Types Needed (mock → eventually PostgreSQL)

```ts
// Match request from a renter to an owner
type MatchStatus = "pending" | "accepted" | "declined" | "confirmed";
interface MatchRequest {
  id: string;
  subletId: string;
  subletTitle: string;
  ownerId: string; // the sublet owner
  requesterId: string;
  requesterName: string;
  requesterInitials: string;
  requesterEmail: string;
  isRequesterPublic: boolean;
  message: string; // sent with the request
  status: MatchStatus;
  createdAt: string;
  threadId?: string; // set when owner accepts → opens conversation
}

// Sublet status (extend existing Sublet type)
type SubletStatus = "active" | "archived" | "draft";
// Add to Sublet: status: SubletStatus, ownerId: string

// User profile (for public profile pages)
interface UserProfile {
  id: string;
  name: string;
  email: string;
  bio: string;
  isPublic: boolean;
  joinedAt: string;
  avatarInitials: string;
}
```

Add to `app/lib/mock-data.ts`:

- `MOCK_MATCH_REQUESTS: MatchRequest[]` — mix of pending/accepted/declined
- `CURRENT_USER_ID = 'user-jon'` — simulates the logged-in user
- `MOCK_USER_PROFILES: UserProfile[]`
- Add `status` and `ownerId` fields to `Sublet`

---

## 4. Feature Roadmap

### Phase 1 — Match Request Flow `[x]`

The core differentiator. Everything else depends on this data model existing.

1. `[x]` Add `MatchRequest`, `UserProfile`, `SubletStatus`, `MatchStatus` types + mock data to `mock-data.ts`
   - `CURRENT_USER_ID = 'user-jon'` (Jon owns sublets 1, 3, 6)
   - 5 user profiles (jon, kelly, alex, jordan, maya)
   - 6 match requests: 4 to Jon's listings, 2 from Jon to others
2. `[x]` Add `status` + `ownerId` to `Sublet` type and all 12 mock entries
3. `[x]` **Request Match button** on `/sublet/[id]` for non-owners
   - `app/components/sublet/request-match-modal.tsx` — dialog with optional message, success state, existing-request status display
   - `app/components/sublet/owner-controls.tsx` — Edit (→ /listings/[id]/edit) + Archive + Delete (both with confirmation dialogs)
   - Owner branch: OwnerControls in header + "This is your listing" CTA
   - Non-owner branch: FavoriteButton in header + RequestMatchModal in CTA
4. `[x]` **Owner badge** on SubletCard ("Your listing") and SubletMiniCard ("Yours") when `sublet.ownerId === CURRENT_USER_ID`
5. `[x]` **Favorites guard** — users cannot favorite their own sublets. Clicking the heart on an owned card opens a Dialog: "Can't save your own listing." Implemented via `isOwner` prop on `CardFavoriteButton`, passed down from `SubletCard` and `SubletMiniCard`. On the detail page, owners never see `FavoriteButton` — `OwnerControls` is shown instead. UI-only guard for now; enforce server-side when auth is real.

### Phase 2 — Listings Management `[ ]`

Route: `app/(all_pages)/(logged_in)/(_dashboard)/listings/page.tsx`

- `page.tsx` — **server component**: reads owner's sublets
- Per-listing row or card: title, status badge, request count, Edit / Archive / Delete actions
- Archive = sets `status: 'archived'`, hides from public browse but keeps data
- Delete = hard delete with confirmation dialog, with pop up modal confirming user choice before deleting
- `[ ]` "Add new listing" → `/listings/new`
- `[ ]` `/listings/new` — multi-step form (details → availability → review)
  - See Phase 2a - List Add New Listing Form
- `[ ]` `/listings/[id]/edit` — same form pre-filled
- `[ ]` Per-listing request inbox: expandable panel or linked modal showing all `MatchRequest`s for that sublet
- Client sub-components:
  - `app/components/listings/archive-button.tsx`
  - `app/components/listings/delete-confirm-dialog.tsx`
  - `app/components/listings/request-inbox.tsx` (`'use client'` — expandable list)

#### Phase 2a - List Add New Listing Form `[ ]`

All information needed:

- Title
- Description
- Duration
- Quarters Available
- Type (of Sublet)
  - Entire place: Will the subletter have the entire place to themseleves
  - Private room: Will the subletter have a private room but a shared living space (e.g. shared common spaces)
    - Roomates (This pops up if private room is selected)
      - How many roomates? (Not including subletter)
- Price/month
- Utilities (Two options: included in price/month or user enters the utilities cost)
- Media (Images and videos only)
  - Ask user to set a featured image

### Phase 3 — Dashboard Enhancements `[ ]`

There are two categories of requests: requests a user has **sent** and requests a user has **received**. Received requests can come in the form of pending requests (a user has requested a sublet), In-Talks requests (the owner has approved the request to talk more), and Confirmed/Approved matches (the owner has confirmed to sublet to the requestee). Give suggestions for what to name these distinct categories to help users understand what each mean.

- `[ ]` **Your Requests section** (new): show sublet name, price, sublet owner name (linked to profile if public), timestamp.
- `[ ]` **Pending Match Requests section** (upgrade existing): show sublet name, requester name (linked to profile if public), message preview (expandable), timestamp. Accept opens thread + sends notification. Decline with optional message.
- `[ ]` **Approved Matches Requests section** (new): accepted requests awaiting owner confirmation. Each row: sublet, requester, "View Conversation" → messages, "Confirm Sublet" button.
  - Confirming archives the sublet and triggers notifications to all other requestees.
- `[ ]` **Approved/Confirmed Matches section** (new): make this for now, but considering removing the request from this section and adding a section/column to the users listing to show who the user picked as the subleter
- `[ ]` **My Listings section**: add "Manage all →" link to `/listings`

### Phase 4 — Matches Page `[ ]`

Route: `app/(all_pages)/(logged_in)/(_dashboard)/matches/page.tsx`

Full view of all match requests the owner has accepted (and pending confirmation):

- Filter tabs: All · Pending Confirmation · Confirmed
- Each card: sublet info, requester profile link, conversation link, Confirm Sublet action
- `page.tsx` — **server component**
- `app/components/match/confirm-sublet-button.tsx` — **client component**

### Phase 5 — Public Profile Pages `[ ]`

Route: `app/(all_pages)/(logged_in)/profile/[userId]/page.tsx`

- `page.tsx` — **server component**: renders profile data
- Shows: name, bio, joined date, public listings
- Only accessible if `profile.isPublic === true`; otherwise shows "Private profile"
- Owner of a request can navigate here from the Match Requests section

### Phase 6 — Settings Page `[ ]`

Route: `app/(all_pages)/(logged_in)/(_dashboard)/settings/page.tsx`

Sections (all client — forms):

- **Profile**: display name, bio, profile photo (initials fallback), **Public profile toggle**
- **Notifications**: new match request · match accepted · sublet no longer available · new message
- **Account**: email, password change, Northwestern email verification badge
- **Listing defaults**: contact preference (messages only vs. show email)
- **Danger zone**: delete account (confirmation dialog), export data

`app/components/profile/edit-profile-form.tsx` — `'use client'`
`app/components/profile/visibility-toggle.tsx` — `'use client'`

### Phase 7 — Browse + SubletCard Owner Awareness `[ ]`

- `[ ]` Filter out `status: 'archived'` sublets from browse results
- `[ ]` Show "Your listing" indicator on cards when `sublet.ownerId === CURRENT_USER_ID`
- `[ ]` Replace Request/Heart buttons with Edit/Archive on owner's own cards
- `[ ]` Add match count badge to owner's cards (e.g. "3 requests")

### Phase 8 — Messages Enhancements `[ ]`

- `[ ]` Thread header shows linked sublet (name + price) when thread originated from an accepted match
- `[ ]` "Confirm Sublet" action in conversation header (owner only, when thread is match-linked)
- `[ ]` Match status indicator chip in thread list (Accepted · Confirmed)

---

## 5. File Structure (target state)

```
app/
  (all_pages)/
    (logged_in)/
      (_dashboard)/
        dashboard/page.tsx          [x] server-friendly, 'use client' for interactivity
        listings/
          page.tsx                  [ ] server
          new/page.tsx              [ ] client (form)
          [id]/edit/page.tsx        [ ] client (form)
        matches/page.tsx            [ ] server + client island
        favorites/page.tsx          [x] 'use client'
        messages/page.tsx           [x] 'use client'
        settings/page.tsx           [ ] 'use client' (forms)
      browse/page.tsx               [x] 'use client'
      sublet/[id]/page.tsx          [x] server
      profile/[userId]/page.tsx     [ ] server

app/components/
  sublet/
    back-button.tsx                 [x]
    favorite-button.tsx             [x]
    request-match-modal.tsx         [ ] 'use client'
    owner-controls.tsx              [ ] 'use client'
  match/
    accept-button.tsx               [ ] 'use client'
    confirm-sublet-button.tsx       [ ] 'use client'
    request-card.tsx                [ ] 'use client' (expandable)
  listings/
    archive-button.tsx              [ ] 'use client'
    delete-confirm-dialog.tsx       [ ] 'use client'
    request-inbox.tsx               [ ] 'use client'
  profile/
    edit-profile-form.tsx           [ ] 'use client'
    visibility-toggle.tsx           [ ] 'use client'

app/ui/
  sublet-card.tsx                   [x]
  sublet-mini-card.tsx              [x]
  search-bar.tsx                    [x]
  pagination.tsx                    [x]
  skeletons.tsx                     [x]
```

---

## 6. Deferred / Out of Scope for Now

- Real authentication (NextAuth / Clerk) — currently simulated with `CURRENT_USER_ID`
- PostgreSQL integration — currently all mock data
- File uploads for listing images — currently color placeholders
- Real-time notifications (WebSocket / Supabase Realtime) — currently mock
- Email notifications — deferred to backend
- Mobile app — web-only for now
