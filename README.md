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
| Icons | [Heroicons v2](https://heroicons.com) |
| Fonts | [Geist](https://vercel.com/font) (via `next/font`) |
| Utilities | [clsx](https://github.com/lukeed/clsx) |

### Backend
| Layer | Choice |
|---|---|
| Infrastructure | [AWS CDK](https://aws.amazon.com/cdk/) (TypeScript) |
| Database | PostgreSQL (planned) |
| Auth | NextAuth (planned) |

### Project Structure
```
app/
├── (all_pages)/          # Authenticated/inner app pages
│   ├── browse/           # Listing search & filter page
│   └── sublet/[id]/      # Individual listing detail
├── components/           # Shared UI components (NavBar, NavSidebar)
├── lib/                  # Data layer (mock data, types)
├── ui/                   # Reusable UI primitives (cards, skeletons, pagination)
└── page.tsx              # Public landing page
backend/                  # AWS CDK infrastructure stack
```

## Getting Started

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

## Scripts

```bash
npm run dev      # Start development server
npm run build    # Production build
npm run start    # Start production server
npm run lint     # Run ESLint
```
