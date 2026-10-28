# SubletNU — Feature & Architecture Plan

> Edit this file freely. Claude reads it at the start of relevant sessions.
> Status tags: `[ ]` not started · `[~]` in progress · `[x]` done
> Last reconciled with the repo: 10/13/26 (after PR #9, `migration-tooling-implementation`).

**NOTE** While planning check if there's a shadcn equivalent.

**Paths:** npm-workspaces monorepo (ADR 5). Frontend paths below are relative to
`apps/frontend/` unless they start with `apps/` or `packages/`.

---

## 0. Where things stand

| Area | State |
|---|---|
| Frontend | All v1 pages built on **mock data** (`app/lib/mock-data.ts`); auth simulated with `CURRENT_USER_ID = 'user-jon'` |
| Frontend hosting | **Vercel Hobby** (ADR 4) |
| Shared types | `packages/shared` (`Sublet`, `Quarter`, `SubletDisplayStatus`), re-exported via `app/lib/definitions.ts` |
| Database | Schema + 4 migrations (`apps/backend/db/migrations/`, node-pg-migrate, raw SQL only — ADR 6); runs in local docker and CI only. **No deployed RDS, no repository layer, no app code reads Postgres yet** |
| AWS (CDK) | Only billing guardrails deployed: SNS alert topic + 4 budgets ($10/$25/$50 actual, $30 forecast). `apps/backend/functions/*` are empty placeholders |
| CI | `ci-frontend.yml` (typecheck, lint, vitest, build) · `ci-backend.yml` (typecheck, migrate up → down-all → up, jest DB tests) |

---

## 1. Navigation Architecture `[x]`

The hamburger **NavSidebar** (`app/components/nav-sidebar.tsx`) holds only top-level destinations; the **DashboardSidebar** (`app/components/dashboard-sidebar.tsx`) navigates within the account area.

| NavSidebar (hamburger) | DashboardSidebar |
| --- | --- |
| Home | Dashboard |
| Browse | My Listings |
| Dashboard _(entry point)_ | Favorites |
| | Requests & Matches (`/requests`) |
| | Messages |
| | Settings (`/settings`) |

**Rationale:** account-level features in both sidebars signal the wrong hierarchy. The hamburger gets you _to_ the account area; the dashboard sidebar navigates _within_ it.

---

## 2. Rendering Architecture

> **Sources:** [Next.js Rendering Strategies](https://medium.com/@md-lens/exploring-next-js-rendering-strategies-a-comprehensive-guide-f06cb3941f22) · [PPR in Production 2026](https://samcheek.com/blog/nextjs-partial-prerendering-production-2026) · [PPR Deep Dive](https://dev.to/pockit_tools/nextjs-partial-prerendering-ppr-deep-dive-how-it-works-when-to-use-it-and-why-it-changes-48dk) · [PPR in Next.js 16](https://www.ashishgogula.in/blogs/a-practical-guide-to-partial-prerendering-in-next-js-16) · [Next.js PPR Platform Guide](https://nextjs.org/docs/app/guides/ppr-platform-guide)

### 2a. Component-Level: Server vs Client

**Default: server component unless interactivity is required.**

| Needs | Use |
| --- | --- |
| Display data, no events | **Server component** — no bundle cost, zero hydration |
| `useState`, event handlers, forms | **`'use client'`** — isolated island |
| Browser APIs (`window`, `router.back`) | **`'use client'`** — not available on server |
| Context providers | **`'use client'`** — must wrap client tree |

**Pattern:** `page.tsx` (server) → passes data as props → imports small `'use client'` islands.

**Privacy rule at the boundary:** props passed to a Client Component are serialized into the page payload. Never pass another student's full `Sublet` to a client island — convert with `toPublicSublet()` (`app/lib/util-address.ts`) to a `PublicSublet` (no `streetAddress`, approximate coords) first. Exact address only for owner / confirmed renter (`canSeeExactAddress`).

**Anti-patterns to avoid:**

- Adding `'use client'` to a whole page just to use `useRouter` — extract a tiny `<BackButton>` instead
- Fetching data inside a client component when a server parent could pass it as props
- Wrapping entire layouts in `'use client'` context — keep contexts narrow
- setState placement — see `.claude/docs/react-state.md` (subscriptions via `useSyncExternalStore`, not setState-in-effect)

**Current pages (verified 10/13/26):**

```
Server pages:  /, /browse (+ browse-filters-client island), /sublet/[id], /dashboard,
               /listings, /listings/[id]/edit (ownership check → ListingForm island),
               /requests, /messages (+ messages-client island), /profile/[userId],
               /login, /signup
Client pages:  /favorites, /listings/new, /settings
404:           app/not-found.tsx — unmatched URLs and every notFound() call
```

### 2b. Page-Level: Partial Prerendering (PPR) `[ ]` — planned, not enabled

Next.js 16 ships PPR via `cacheComponents: true`. **`next.config.ts` does not set it yet** (it currently sets only `output: 'standalone'` and `outputFileTracingRoot`). Enable it once real data fetching exists — with mock data there's nothing dynamic to stream.

The dividing line is `<Suspense>`: everything outside = static shell, everything inside = streamed.

**Measured performance gains (p75 mobile, from the sources above):**

| Metric | Full SSR | PPR | Gain |
|---|---|---|---|
| TTFB | 300–800 ms | 20–80 ms | **4–10×** |
| LCP | 1.8–2.4 s | 0.6–1.2 s | **~3×** |
| CLS | variable | 0 (with sized skeletons) | eliminated |

### 2c. Per-Route Rendering Targets

| Route | Target | Notes |
| --- | --- | --- |
| `/` (home) | **SSG** | Pure static marketing content |
| `/browse` | **PPR** | Shell: layout, filter sidebar. Holes: results, pagination, map |
| `/sublet/[id]` | **PPR** | Shell: title, description, images, specs. Holes: favorite state, request/owner controls |
| `/listings` | **PPR** | Shell: header. Holes: listing cards with live request counts |
| `/listings/new` | **CSR** | Multi-step form |
| `/listings/[id]/edit` | **Server check → CSR form** | Ownership check must run before anything suspends (see §7, 404 status) |
| `/dashboard` | **PPR** | Shell: section headers. Holes: each card section |
| `/requests` | **PPR** | Shell: tabs/header. Holes: request tables |
| `/favorites` | **CSR** | Unfavoriting mutates the list in real time |
| `/messages` | **CSR island** | Polling per ADR 3 (WebSockets in v2) |
| `/profile/[userId]` | **PPR** | Shell: bio, name. Holes: public listings |
| `/settings` | **CSR** | All forms |

### 2d. PPR Suspense Boundary Rules

1. **One boundary per independent concern** — slow queries don't block fast ones.
2. **≤ 5–6 Suspense boundaries per route** — beyond that streaming overhead outweighs parallelism.
3. **Keep `searchParams` inside Suspense** — reading it in the static shell forces the whole page to SSR.
4. **Skeleton dimensions must match final content** — mismatched fallbacks cause CLS > 0.1.
5. **LCP images belong in the static shell** — `next/image` there emits `<link rel="preload">`.
6. **Call `notFound()` before any Suspense boundary or suspending `await`** — once streaming starts the status code is locked at 200 (Next docs, `loading.md` → Status Codes).

### 2e. Deployment Architecture — decided in ADR 4

**Split: Vercel Hobby (frontend) + API Gateway → Lambda → RDS PostgreSQL on AWS via CDK (backend).**

- RDS in a private subnet, reachable by security group only; Lambda in the VPC.
- Budget: **< $30/month** total (CLAUDE.md). Hard rules: no NAT Gateway, ALB, Multi-AZ RDS, provisioned Aurora, or always-on compute without stopping to ask with a $ estimate and cheaper alternative; every new resource's monthly cost in the PR; every log group with explicit retention.
- Hobby-tier eligibility depends on SubletNU staying non-commercial (no payments, ads, affiliate links, donations) — ADR 4's revisit trigger.
- _Superseded:_ the earlier SST/OpenNext → ECS Fargate + ALB + ElastiCache plan (~$50–100/month) broke the budget and the no-ALB rule.

### 2f. Client Component Folder Layout (actual)

```
app/components/
  sublet/      back-button, favorite-button, card-favorite-button, image-gallery,
               owner-controls, request-match-modal, sublet-card, sublet-mini-card
  listings/    listing-card, listing-form, listings-pagination, request-inbox,
               archive-button, delete-confirm-dialog
  dashboard/   received-requests-table, sent-requests-table, favorites-scroll-card
  requests/    cards-layout
  match/       confirm-sublet-button
  messages/    messages-client, conversation-panel, thread-row
  map/         interactive-map
  login_signup/ login-form, signup-form
  ui/          edit-profile-form, visibility-toggle
  (root)       navbar, nav-sidebar, dashboard-sidebar, search-bar, pagination,
               skeletons, confirm-dialog, loading-spinner, notification-banner, …
components/ui/ shadcn primitives + vendored map.tsx (shadcn-map)
app/lib/       definitions.ts, mock-data.ts, utils.ts (client hooks OK),
               util-address.ts (server-safe: no React imports)
```

`app/lib/utils.ts` imports a React hook, so **Server Components must not import it** — server-safe helpers go in their own module (precedent: `util-address.ts`).

---

## 3. Data Model

Sources of truth — read these, don't copy them here (an inline copy drifted before):

- **Schema:** `apps/backend/db/migrations/` builds it; `apps/backend/db/schema.sql` is the hand-maintained snapshot after the latest migration (verified identical on PR #9); `apps/backend/db/erd.md`.
- **Types:** `packages/shared/src/index.ts` (`Sublet` etc.), re-exported + frontend-only types in `app/lib/definitions.ts` (`PublicSublet`, `ListingFormData`, `MessageMedia`, …).
- **Conventions:** `.claude/docs/sql.md`, `.claude/docs/migrations.md`.

Notable decisions so far:

- Day 2: `Sublet.status` → `displayStatus` + `isDraft` + `confirmedRenterId` (stored), with `deriveSubletStatus()` in `app/lib/utils.ts` computing the display label. `MatchStatus` includes `cancelled` / `listing_removed`.
- Day 3 renames (DB → TS): `street_address`/`streetAddress` + new `city`, `state`, `zip_code`/`zipCode` (neighborhood dropped for specificity); `bedroom_count`, `bathroom_count`, `monthly_rent`, `roommate_count`, `monthly_utilities_cost`; `message_media.file_name`/`fileName`. `sublet_images.alt` added (no width/height — upload-pipeline concern).

---

## 4. Frontend Feature Roadmap

### Phase 1 — Match Request Flow `[x]`

1. `[x]` `MatchRequest`, `UserProfile`, `SubletStatus`, `MatchStatus` types + mock data (`CURRENT_USER_ID = 'user-jon'`; 13 mock sublets, 5+ profiles, mixed sent/received requests)
2. `[x]` `ownerId` on `Sublet` (visibility now via `displayStatus`/`isDraft` — see §3)
3. `[x]` **Request Match** on `/sublet/[id]` for non-owners (`request-match-modal.tsx`); owners get `owner-controls.tsx` (Edit / Archive / Delete with confirmation)
4. `[x]` **Owner badge** on SubletCard ("Your listing") and SubletMiniCard ("Yours")
5. `[x]` **Favorites guard** — can't favorite your own sublet (UI-only; enforce server-side when auth is real)

### Phase 2 — Listings Management `[x]`

Route: `app/(all_pages)/(logged_in)/(_dashboard)/listings/`

- `[x]` `page.tsx` (server) — owner's listings with status badge, request count, actions
- `[~]` Archive / Delete — confirmation dialogs built, but the actions are a simulated delay with no state change (`owner-controls.tsx` TODO). Real behavior: archive = `displayStatus → 'private'` (data kept); delete = soft delete (`display_status = 'deleted'`), per schema.sql's no-hard-delete convention
- `[x]` `/listings/new` — multi-step form (The Basics → Pricing, Availability & Details → Review)
- `[x]` `/listings/[id]/edit` — same form pre-filled; non-owner → 404
- `[x]` Per-listing request inbox (`request-inbox.tsx`)
- `[x]` Form fields: place type (+ roommate count for private room), street address / city / state / ZIP, bedrooms, bathrooms, monthly rent, utilities (included or monthly estimate), quarters, dates, title, description
- `[ ]` Media upload + featured image — placeholder panel only (see §5 photo upload)

### Phase 3 — Dashboard Enhancements `[x]`

Sections: Incoming Requests · In Talks · Confirmed Sublets · My Applications · My Listings. Withdraw/accept/decline/confirm are optimistic UI on mock data (see §7).

### Phase 4 — Requests & Matches Page `[x]`

Route: `/requests` (sidebar "Requests & Matches"). ReceivedRequestsTable (owner) + SentRequestsTable (renter), both with `fullPage` prop. `confirm-sublet-button.tsx` reused in the messages header.

### Phase 5 — Public Profile Pages `[x]`

Route: `/profile/[userId]` (server). Name, bio, joined date, public listings (as `PublicSublet`). Unknown id → 404; private profile card when `isPublic === false` and not own profile.

### Phase 6 — Settings Page `[x]`

Route: `/settings` (client). Profile, Notifications, Account, Listing defaults, Danger zone. `edit-profile-form.tsx` and `visibility-toggle.tsx` live in `app/components/ui/`. Helpers `toInitials`, `isNorthwesternEmail` in `app/lib/utils.ts`.

### Phase 7 — Browse + Owner Awareness `[x]` (one item deferred)

- `[x]` Browse shows only `displayStatus === 'public'`
- `[x]` "Your listing" indicator + "Edit listing" button replaces heart on own cards
- `[ ]` Match count badge on owner's cards (e.g. "3 requests") — deferred

### Phase 8 — Messages Enhancements `[x]`

Linked-sublet header, owner "Confirm Sublet" in header, match status chip in thread list.

### Phase 9 — Login / Signup `[x]` (UI only)

Login + 2-step signup, password strength, client validation, WCAG labels. Real auth is §5.

### Phase 10 — Map `[x]`

- `[x]` `coords` on `Sublet`; map shows all filtered sublets; marker click scrolls/pages to the card
- `[x]` **Privacy:** pins + shaded 200m circles at grid-snapped approximate coords (never exact); block-level address ("1200 block of …") for non-owners
- `[x]` **Performance:** marker clustering with chunked loading; circles culled to viewport at zoom ≥ 14 on a shared canvas; memoized markers; `useLeaflet` cached and draw/fullscreen plugins opt-in
- `[x]` **Data Saver** (`useSaveData`): desktop map waits for "Load map"; no animations, tiles fetched when idle. Real-world reach is small (`prefers-reduced-data` is flag-only; Chrome Lite mode removed 2022)
- `[ ]` Geocoding (`addressToLatLng` / `latLngToAddress`) via AWS Location Service when listings are created for real
- `[ ]` Optional: in-app "Data saver" setting (reliable, unlike the browser signals)

---

## 5. Backend Track

Done:

- `[x]` **Day 1** — cost baseline template (`.claude/docs/cost-baseline.md`), CDK billing alerts + budgets (PR #4)
- `[x]` **Day 2** — schema + ERD, frontend types aligned (PR #6); monorepo restructure + `packages/shared` (PR #7, ADR 5)
- `[x]` **Day 3** — node-pg-migrate + 4 migrations, local Postgres in docker-compose, backend CI, first DB test, column-rename audit, address privacy model, 404 page (PR #9, ADR 6)

Next candidates (order to be decided — each needs its own plan/branch per CLAUDE.md):

- `[ ]` **Repository layer** (`UserRepository`, `ListingRepository`, `MatchRepository`, `MessageRepository` per sql.md) — raw parameterized SQL; browse/search returns the `PublicSublet` shape **in SQL** and selects `street_address` only when the session user is owner or confirmed renter (CLAUDE.md rule 4). Removes the remaining exposure: `mock-data.ts` is bundled into ~12 client components today.
- `[~]` **Index optimization** — current branch `index-optimization`. Composite index column order must be justified (sql.md); `EXPLAIN (ANALYZE, BUFFERS)` for queries on tables > ~1,000 rows.
- `[ ]` **Match state machine** in `MatchRepository` — transitions in a row-locked transaction; withdraw becomes a real `→ cancelled` transition (fixes §7).
- `[ ]` **Auth** (NextAuth planned) — `@u.northwestern.edu` enforced server-side at token validation; replaces `CURRENT_USER_ID`. Re-add `AUTH_*` keys to `.env.example` then.
- `[ ]` **AWS backend per ADR 4** — RDS (private subnet), Lambda, API Gateway via CDK. Cost estimate per resource before provisioning; explicit log retention. Prerequisite: the migration role needs `rds_superuser` for `CREATE EXTENSION postgis` (see TODO.md, "Revisit later").
- `[ ]` **Photo upload** — presigned S3 URLs (scoped prefix, short expiry, size-limited); revisit image width/height at that point.
- `[ ]` **Messaging** — persisted + polling (ADR 3); WebSockets in v2.
- `[ ]` **Notifications** — fan-out in application code (schema.sql notes why not triggers); email via SES later.

---

## 6. Deferred / Out of Scope for Now

- Real-time notifications/messaging (v2 per ADR 3) — currently mock
- Email notifications — deferred to backend
- Mobile app — web-only
- Pages linked but not built: `/forgot-password`, `/terms` (see `TODO.md`)
- `components/ui/map.tsx` `react-hooks/exhaustive-deps` warnings (5) — vendored component; non-blocking
- Data retention purge job (1-year soft-delete purge, documented in `schema.sql`)

## 7. Known Structural Inconsistencies

- **Withdraw is local UI state, not a status transition.** `app/components/dashboard/sent-requests-table.tsx` (and the same pattern in `app/components/requests/cards-layout.tsx`) keeps a `Set<string>` of "withdrawn" ids. The schema models withdrawal as `→ cancelled`; deleting the row would destroy the `last_transitioned_at` history the 7-day re-request cooldown needs. Fix with the match state machine (§5).
- **`/listings/[id]/edit` 404 returns HTTP 200** — `listings/loading.tsx` starts streaming before `notFound()`. No data leaks; options weighed in `TODO.md` ("Revisit later"). Revisit with the repository layer.
- **Exact addresses still in the client bundle** via `mock-data.ts` imports in client components — UI and page payloads are clean; the repository layer closes this (§5).
- **`docker compose up dev` requires DB keys** because `dev` depends on `db`, though the frontend doesn't read `DATABASE_URL` yet — decide whether to keep the dependency.
