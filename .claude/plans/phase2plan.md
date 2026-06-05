# Phase 2 — Listings Management

## Context

Phase 2 adds the `/listings` dashboard section where owners can manage their sublets.
Jon (CURRENT_USER_ID='user-jon') owns sublets 1, 3, 6 and will gain a 4th (id '13').
He has 4 inbound match requests (mr1–mr4) plus a new confirmed one (mr7 for sublet 13).
This plan also includes prerequisite renames to mock-data (Season→Quarter, destructive→dangerous).

---

## Pre-work: Renames that Phase 2 depends on

### A. `Season` → `Quarter` throughout the codebase

**`app/lib/mock-data.ts`** — rename type, rename field on Sublet, rename param in getFilteredSublets:

```ts
// Before
export type Season = "Fall" | "Winter" | "Spring" | "Summer";
// interface Sublet:  seasons: Season[];
// getFilteredSublets param: seasons?: Season[];
// filter body:       s.seasons.some(...)

// After
export type Quarter = "Fall" | "Winter" | "Spring" | "Summer";
// interface Sublet:  quarters: Quarter[];
// getFilteredSublets param: quarters?: Quarter[];
// filter body:       s.quarters.some(...)
```

All 12 `MOCK_SUBLETS` entries: rename `seasons: [...]` → `quarters: [...]`.

**Other files to update (find+replace `Season`→`Quarter`, `seasons`→`quarters`):**

- `app/(all_pages)/(logged_in)/browse/browse-filters-client.tsx` — import, `UrlFilters.seasons` field, `ALL_SEASONS` constant, url param key `'seasons'`, all `filters.seasons` references
- `app/(all_pages)/(logged_in)/browse/page.tsx` — import, `raw('seasons')`, `s is Season`, `getFilteredSublets({ seasons: ... })`
- `app/(all_pages)/(logged_in)/sublet/[id]/page.tsx` — `sublet.seasons`, text "Available Seasons" → "Available Quarters"
- `app/components/sublet/sublet-card.tsx` — `sublet.seasons.map`
- `app/components/skeletons.tsx` — any season string literals in skeleton labels

---

### B. `variant="destructive"` → `variant="dangerous"` in Button

**`components/ui/button.tsx`** — rename the cva variant key only (CSS color tokens stay unchanged):

```ts
// Before
destructive: "bg-destructive/10 text-destructive hover:bg-destructive/20 ...";
// After
dangerous: "bg-destructive/10 text-destructive hover:bg-destructive/20 ...";
```

Update `ButtonProps` type to include `'dangerous'` instead of `'destructive'`.

**Other files to update (2 occurrences):**

- `app/components/sublet/owner-controls.tsx` lines 86, 103: `variant="destructive"` → `variant="dangerous"`

---

## Mock Data Additions

### C. 4th listing for Jon + confirmed match request

**Add to `MOCK_SUBLETS`** (id '13'):

```ts
{
  id: '13',
  title: 'Renovated 1BR, Utilities Included',
  address: '512 Noyes St, Evanston, IL',
  neighborhood: 'Central Evanston',
  price: 1750, beds: 1, baths: 1, sqft: 580,
  quarters: ['Winter', 'Spring'],
  startDate: '2026-01-01', endDate: '2026-05-31',
  description: 'Fully renovated one-bedroom with all utilities included...',
  imageHue: '200',
  ownerId: 'user-jon', status: 'active',
}
```

**Add to `MOCK_MATCH_REQUESTS`** (mr7 — confirmed subletter):

```ts
{
  id: 'mr7',
  subletId: '13',
  subletTitle: 'Renovated 1BR, Utilities Included',
  ownerId: 'user-jon',
  requesterId: 'user-kelly',
  requesterName: 'Kelly Tween',
  requesterInitials: 'KT',
  requesterEmail: 'kelly.tween@u.northwestern.edu',
  isRequesterPublic: true,
  message: 'Looking forward to subletting! See you in January.',
  status: 'confirmed',
  createdAt: '2026-05-20T09:00:00',
  threadId: 't4',
}
```

### D. Extend `Sublet` interface (all optional, no existing entries need updating)

```ts
placeType?: 'entire' | 'private';
roommates?: number;
utilitiesIncluded?: boolean;
utilitiesCost?: number;
featuredImage?: string;   // hero image; falls back to images?.[0] if not set
videos?: string[];
```

---

## New Files to Create

### 1. `app/components/confirm-dialog.tsx` — `'use client'` (generic reusable)

**Props:**

```ts
interface ConfirmDialogProps {
  trigger: React.ReactNode;
  title: string;
  description: React.ReactNode; // can contain <strong> for listing name
  confirmLabel: string; // "Archive listing" / "Delete listing" / "Restore listing"
  confirmVariant?: "default" | "dangerous"; // defaults to 'default'
  onConfirm: () => Promise<void> | void;
}
```

**State:** `open`, `loading`

- Renders `Dialog` with `DialogTrigger` wrapping `trigger`
- On confirm: `setLoading(true)` → `await onConfirm()` → `setLoading(false)` → `setOpen(false)`
- Loading label derived by appending "…" to `confirmLabel`
- Both buttons disabled while loading
- Pattern is identical to `owner-controls.tsx` but generic

---

### 2. `app/components/listings/archive-button.tsx` — `'use client'`

**Props:** `subletTitle, isArchived, onArchive, onUnarchive`
Uses `ConfirmDialog` for **both paths** — no immediate actions.

- **Archive path:** trigger="Archive" (`ArchiveBoxIcon`), description explains hidden from browse, confirms with `onArchive()`
- **Restore path:** trigger="Restore" (`ArchiveBoxXMarkIcon`), description explains re-listed on browse, confirms with `onUnarchive()`

---

### 3. `app/components/listings/delete-confirm-dialog.tsx` — `'use client'`

**Props:** `subletTitle, onDelete`
Uses `ConfirmDialog`:

- trigger: `Button variant="dangerous" size="xs"` + `TrashIcon` + "Delete"
- confirmLabel: "Delete listing", `confirmVariant="dangerous"`

---

### 4. `app/components/listings/request-inbox.tsx` — `'use client'` (stateless display)

**Props:** `requests: MatchRequest[]`
Per-request `RequestRow`:

- Avatar (initials in violet circle), requester name, status badge, message preview (`line-clamp-2`), relative timestamp
- "View in messages" link when `request.threadId` is set
- No message → italic "No message attached"
- Status badge colors: pending=amber, accepted=green, declined=red, confirmed=violet
- `relativeTime(iso)` — mirrors `navbar.tsx` pattern (Xm/Xh/Xd ago)

---

### 5. `app/components/listings/listing-card.tsx` — `'use client'`

**Props:** `sublet: Sublet, requests: MatchRequest[]`
**State:** `status`, `deleted`, `inboxOpen`

- `deleted === true` → `return null`
- Layout: `bg-white rounded-2xl border border-gray-200`
  - Left 20×20 swatch: `hsl(imageHue 60% 85%)`
  - Center: title + StatusBadge, address, price + beds/baths (no sqft), quarter chips
  - Right: request count pill (rotating chevron), then Edit / Archive / Delete
- Request pill toggles `inboxOpen`; when open: `border-t` + `<RequestInbox>` (or "No requests yet")
- StatusBadge: active=green, archived=gray, draft=amber

---

### 6. `app/(all_pages)/(logged_in)/(_dashboard)/listings/page.tsx` — server component

```ts
const params = await searchParams;
const myListings = MOCK_SUBLETS.filter((s) => s.ownerId === CURRENT_USER_ID); // 4 listings
const requestsBySublet = Object.fromEntries(
  myListings.map((s) => [
    s.id,
    MOCK_MATCH_REQUESTS.filter((r) => r.subletId === s.id),
  ]),
);
```

- Green success banner when `params.created === '1'` or `params.updated === '1'`
- Header: "My Listings" (count) + "Add listing" → `/listings/new`
- `<div className="space-y-4">` of `<ListingCard>` × 4

---

### 7. `app/components/listings/listing-form.tsx` — `'use client'`

**3-step form:**

| Step | Title                           | Key fields                                                                                                                                                                                                                                         |
| ---- | ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | The Basics                      | placeType toggle (entire/private room), roommates `NumberStepper` (if private), address, neighborhood, beds chips (Studio/1/2/3/4+), baths chips (1/1.5/2/2.5/3)                                                                                   |
| 2    | Pricing, Availability & Details | price, utilities toggle+cost, **quarters** chips (Fall/Winter/Spring/Summer), start/end dates (Calendar+Popover), title (80 char), description (1000 char), media placeholder (disabled — "Upload coming soon"; note about featuredImage fallback) |
| 3    | Review                          | Read-only summary + "Publish listing" / "Save changes"                                                                                                                                                                                             |

**FormData type** (exported for edit page):

```ts
export interface ListingFormData {
  placeType: "entire" | "private";
  roommates: number;
  address: string;
  neighborhood: string;
  beds: number;
  baths: number;
  price: number;
  utilitiesIncluded: boolean;
  utilitiesCost: number;
  quarters: Quarter[];
  startDate: string;
  endDate: string;
  title: string;
  description: string;
}
```

**Validation:**

- Step 1: address, neighborhood required
- Step 2: price > 0; ≥1 quarter; both dates set; startDate < endDate; if !utilitiesIncluded then utilitiesCost > 0; title required + ≤80; description required + ≤1000

**On submit:** 500ms mock delay → `router.push('/listings?created=1')` or `?updated=1`

**Step indicator:** 3 numbered circles with connecting lines (gray/violet/checkmark states)

**Inline helpers:** `FieldGroup`, `NumberStepper`, `ReviewSection`, `ReviewRow`

**Media placeholder note in form UI:**

> "If no featured image is selected, the first photo in your gallery will be used. Photo and video uploads will be available in a future update."

---

### 8. `app/(all_pages)/(logged_in)/(_dashboard)/listings/new/page.tsx` — `'use client'`

Thin wrapper rendering `<ListingForm mode="new" />`.

---

### 9. `app/(all_pages)/(logged_in)/(_dashboard)/listings/[id]/edit/page.tsx` — server component

Reads sublet by `await params`, validates ownership, maps Sublet → `ListingFormData` (with `?? defaults`), passes as `initialData` to `<ListingForm mode="edit" subletId={id} initialData={...} />`.

---

## Tests

Follow the pattern in `__tests__/notifications.test.tsx` (vitest + @testing-library/react + user-event, vi.mock for next/navigation and next/link).

**`__tests__/listing-card.test.tsx`**

- Renders a listing card with title, status badge, request count pill
- Clicking request pill expands inbox; clicking again collapses it
- Archive dialog: clicking "Archive" opens dialog; confirming changes badge to "Archived" and Archive btn becomes "Restore"
- Restore dialog: clicking "Restore" opens dialog; confirming changes badge back to "Active"
- Delete dialog: clicking "Delete" opens dialog; confirming causes card to return null (not in DOM)

**`__tests__/request-inbox.test.tsx`**

- Renders correct number of request rows
- Shows "View in messages" link only for requests with threadId
- Shows italic "No message attached" for empty message
- Status badges show correct text (Pending / Accepted / Declined / Confirmed)

**`__tests__/listing-form.test.tsx`**

- Step 1 shows "The Basics" heading
- Clicking "Continue" on empty step 1 shows validation errors for address and neighborhood
- Filling required fields and clicking "Continue" advances to step 2
- Step 2 validation: empty quarters shows error, missing price shows error
- Step 3 shows review summary with entered values
- Clicking "Publish listing" calls router.push('/listings?created=1')

---

## Reuse from Existing Code

- Dialog loading pattern: `app/components/sublet/owner-controls.tsx` → extracted into `ConfirmDialog`
- Color swatch + listing layout: `app/(all_pages)/(logged_in)/(_dashboard)/dashboard/page.tsx` `MyListingsCard`
- Calendar+Popover date picker: `app/(all_pages)/(logged_in)/browse/browse-filters-client.tsx`
- Season chip colors: `app/components/sublet/sublet-card.tsx` `SEASON_COLORS` (rename to `QUARTER_COLORS`)
- `relativeTime()`: `app/components/navbar.tsx`

## Implementation Order

1. `mock-data.ts` — Season→Quarter rename + interface extensions + 4th listing + confirmed request
2. All Season→Quarter call-site updates (browse-filters-client, browse/page, sublet/[id]/page, sublet-card)
3. `components/ui/button.tsx` — destructive→dangerous variant rename
4. `owner-controls.tsx` — update to variant="dangerous"
5. `confirm-dialog.tsx`
6. `archive-button.tsx` + `delete-confirm-dialog.tsx`
7. `request-inbox.tsx`
8. `listing-card.tsx`
9. `listings/page.tsx`
10. `listing-form.tsx`
11. `listings/new/page.tsx` + `listings/[id]/edit/page.tsx`
12. Tests (4 test files)

## Post-Phase 2 Notes

### Favorites — own-listing guard
Users cannot favorite their own sublets. If they click the heart button on a card they own, a Dialog appears: "Can't save your own listing / You can't add your own listing to your favorites." The button is blocked in `CardFavoriteButton` via an `isOwner` prop passed from `SubletCard` and `SubletMiniCard`. On the sublet detail page, the `FavoriteButton` is already hidden for owners — `OwnerControls` is shown instead. No server-side change is needed; this is a UI-only guard for now.

---

## Verification

- `/listings` shows 4 cards (sublets 1, 3, 6, 13)
- Sublet 1: 2 requests (Kelly pending, Alex accepted + thread link)
- Sublet 3: 1 request (Jordan pending, no message)
- Sublet 6: 1 request (Maya declined)
- Sublet 13: 1 request (Kelly confirmed + thread link)
- Archive/Restore both require dialog confirmation before changing state
- Delete requires dialog confirmation → card disappears
- Form: 3 steps, validation blocks advance, submit → success banner
- Edit pre-fills with existing sublet data
- `tsc --noEmit` and `eslint app` both pass
- All 4 test files pass with `npx vitest run`
