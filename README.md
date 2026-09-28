# SubletNU

A short-term housing marketplace for Northwestern University students — find, list, and book sublets from fellow Wildcats.

## Tech Stack

### Frontend
| Layer | Choice |
|---|---|
| Framework | [Next.js 16](https://nextjs.org) (App Router) |
| Language | TypeScript 5 |
| UI Library | [React 19](https://react.dev) |
| Styling | [Tailwind CSS v4](https://tailwindcss.com) |
| Component Library | [shadcn/ui](https://ui.shadcn.com) |
| Map | [shadcn-map](https://shadcn-map.vercel.app) (Leaflet + react-leaflet + leaflet.markercluster) |
| Icons | [Heroicons v2](https://heroicons.com) · [Lucide React](https://lucide.dev/icons) |
| Fonts | [Geist](https://vercel.com/font) (via `next/font`) |
| Testing | [Vitest](https://vitest.dev) · [Testing Library](https://testing-library.com) |

### Backend
| Layer | Choice |
|---|---|
| Infrastructure | [AWS CDK](https://aws.amazon.com/cdk/) (TypeScript) |
| Database | PostgreSQL (planned) |
| Auth | NextAuth (planned) |

---

## Project Structure

npm-workspaces monorepo — see `docs/adr/adr_5_project_structure_backend_frontend.md`:

```
apps/
├── frontend/
│   ├── app/
│   │   ├── (all_pages)/
│   │   │   └── (logged_in)/
│   │   │       ├── (_dashboard)/         # Dashboard route group (shared sidebar layout)
│   │   │       │   ├── dashboard/        # Overview: profile, listings, requests, favorites
│   │   │       │   ├── listings/         # Listings management (create, edit, archive, delete)
│   │   │       │   │   ├── new/          # New listing form (3-step)
│   │   │       │   │   └── [id]/edit/    # Edit existing listing
│   │   │       │   ├── favorites/        # Saved listings
│   │   │       │   └── messages/         # Messaging threads
│   │   │       ├── browse/               # Listing search & filter
│   │   │       └── sublet/[id]/          # Individual listing detail page
│   │   ├── components/
│   │   │   ├── listings/                 # Listing management components
│   │   │   ├── sublet/                   # Sublet card, gallery, match request modal
│   │   │   ├── dashboard/                # Dashboard-specific cards
│   │   │   ├── navbar.tsx                # Top navigation bar with notifications
│   │   │   ├── dashboard-sidebar.tsx     # Dashboard section navigation
│   │   │   ├── confirm-dialog.tsx        # Generic confirmation dialog (with error handling)
│   │   │   └── notification-banner.tsx   # Reusable success/error/warning/info banner
│   │   ├── context/
│   │   │   └── notifications.tsx         # Global notification bell state
│   │   └── lib/
│   │       ├── definitions.ts            # Types/interfaces/constants; re-exports Sublet/Quarter/SubletDisplayStatus from packages/shared
│   │       ├── mock-data.ts              # Mock data (DB replaces later)
│   │       └── utils.ts                  # formatDateToLocal, relativeTime
│   └── __tests__/                        # Vitest test suites
└── backend/                               # AWS CDK infrastructure stack

packages/
└── shared/                                # Domain types shared between apps/frontend and apps/backend
```

---

## Key Architecture Decisions

**Server components by default.** Pages are server-rendered; only interactive islands use `'use client'`. Client state never leaks into server-rendered shells.

**Single import source, shared canonical types.** `Sublet`, `Quarter`, and `SubletDisplayStatus` are canonically defined in `packages/shared` (consumed by `apps/backend` too — see `.claude/docs/sql.md`) and re-exported through `apps/frontend/app/lib/definitions.ts`, so every existing import from `'@/app/lib/definitions'` keeps working unchanged. Everything else (`MatchRequest`, `ListingFormData`, etc.) still lives directly in `definitions.ts`. `mock-data.ts` re-exports the lot for backward compatibility. When the real DB is wired up, only `mock-data.ts` needs to change — no type updates required across the rest of the app.

**Mock data → PostgreSQL.** All data currently comes from `apps/frontend/app/lib/mock-data.ts`. The interfaces in `definitions.ts`/`packages/shared` are designed to map 1-to-1 with the future DB schema. `CURRENT_USER_ID = 'user-jon'` simulates an auth session.

**Price histogram computed server-side.** `browse/page.tsx` computes the histogram before rendering, so the client bundle never loads raw listing data. When the DB is connected, will swap the computation for a single aggregation query.

---

## Getting Started

### Local (no Docker)

```bash
npm install                              # from the repo root — installs the whole workspace
npm run dev --workspace=apps/frontend
```

### Docker — development (hot reload)

```bash
docker compose up dev
```

Source files are mounted from your machine so edits reload instantly. Dependencies are installed automatically inside the container on first run.

### Docker — production build

```bash
docker compose up prod
```

Runs a full `next build` using the multi-stage `Dockerfile` and starts the optimised server.

Open [http://localhost:3000](http://localhost:3000) for either mode.

**Mock logged-in user:** Jon Doe (`user-jon`) — owns sublets 1, 3, 6, and 13.

---

## Scripts

Run from the repo root with `--workspace=apps/frontend`, or `cd apps/frontend` first:

```bash
npm run dev --workspace=apps/frontend         # Start development server
npm run build --workspace=apps/frontend       # Production build
npm run start --workspace=apps/frontend       # Start production server
npm run lint --workspace=apps/frontend        # Run ESLint
npm run typecheck --workspace=apps/frontend   # Type check
npm run test --workspace=apps/frontend        # Run test suite
```

---

## Current Features

- **Browse** — search, filter by price/quarter/dates/place type, paginated results with interactive map (marker clusters, popup previews, click-to-scroll card sync)
- **Sublet detail** — image gallery, availability, details, match request modal
- **Dashboard** — profile, listings preview, incoming requests, favorites carousel
- **Listings management** — create (3-step form), edit, archive/restore, delete with confirmation dialogs
- **Messages** — threaded conversation view
- **Favorites** — saved listings with scroll carousel
- **Notifications** — bell with unread count, dismiss individual or clear all

## Planned

- PostgreSQL integration (replacing mock data)
- Real authentication (NextAuth / Clerk)
- File uploads for listing images and videos
- Matches page (accepted requests pending confirmation)
- Public profile pages
- Settings page
- Real-time notifications