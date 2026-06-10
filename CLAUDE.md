@AGENTS.md

# SubletNU

## Project Overview

A Nextjs web application for a short-term housing marketplace for Northwestern University students — find, list, and book sublets from fellow Northwestern students.

### Tech Stack

#### Frontend

| Layer             | Choice                                                                                        |
| ----------------- | --------------------------------------------------------------------------------------------- |
| Framework         | [Next.js 16](https://nextjs.org) (App Router)                                                 |
| Language          | TypeScript 5                                                                                  |
| UI Library        | [React 19](https://react.dev)                                                                 |
| Styling           | [Tailwind CSS v4](https://tailwindcss.com)                                                    |
| Component Library | [shadcn/ui](https://ui.shadcn.com)                                                            |
| Map               | [shadcn-map](https://shadcn-map.vercel.app) (Leaflet + react-leaflet + leaflet.markercluster) |
| Icons             | [Heroicons v2](https://heroicons.com) · [Lucide React](https://lucide.dev/icons)              |
| Fonts             | [Geist](https://vercel.com/font) (via `next/font`)                                            |
| Testing           | [Vitest](https://vitest.dev) · [Testing Library](https://testing-library.com)                 |

#### Backend

| Layer          | Choice                                              |
| -------------- | --------------------------------------------------- |
| Infrastructure | [AWS CDK](https://aws.amazon.com/cdk/) (TypeScript) |
| Database       | PostgreSQL (planned)                                |
| Auth           | NextAuth (planned)                                  |

---

## Project Architecture

- Route groups: (all_pages), (logged_in), (\_dashboard)
- Server components by default, 'use client' islands for interactivity, make server vs client distinctions
- Mock data in app/lib/mock-data.ts -- to be replaced with DB later

### Key Files and directories

| Layer                    | Choice                                                                                                                                                                                                                                                                                                                     |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app/`                   | the app's root file                                                                                                                                                                                                                                                                                                        |
| `app/(all_pages)`        | all route pages are in this directory                                                                                                                                                                                                                                                                                      |
| `app/components`         | all client components and UI elements are in this directory                                                                                                                                                                                                                                                                |
| `app/lib/definitions.ts` | Holds all type defintions, interfaces, and shared data shapes                                                                                                                                                                                                                                                              |
| `app/lib/utils.ts`       | Utility functions used by multiple components and routes                                                                                                                                                                                                                                                                   |
| `backend/`               | AWS CDK future implementation file location                                                                                                                                                                                                                                                                                |
| `references_mockups/`    | files with the suffix _\_references are design inspiration reference photos and files with suffix _\_mockups are directly designed implementation and supercede any major design designs from \*\_references. For example, if given a dashboard_reference and dashboard_mockup, dashboard_mockup should be followed first. |

## Adding New Features or Fixing Bugs

**IMPORTANT**: When you work on a new feature or bug, create a git branch first. Then work on changes in that branch for the remainder of the session.

1. **Open New Git Branch**: Every new feature must open a new git-branch
2. **Enter Plan Mode**: a plan must be generated based off `.claude/PLAN.md`, `docs/adr` for architectural decisions, and asking elaboration questions. Security and feature tradeoffs must be included.
   1. Extract patterns you observe into separate files: If key architectural decisions need to be made, document the architectural patterns, design decisions, and conventions used with the `docs/adr/adr_template.md`
3. **Write Test Cases**: after implementation tests must be written should not continue until all tests are passed.

## Prompt & Instruction Handling

Use progressive disclosure, instead of including all instructions, create a brief index pointing to other markdown files in .claude/docs for specialized topics

- Include file:line references instead of code snippets

## Coding Conventions

- Quarters not Seasons
- Use ' not &apos;

## IMPORTANT! MUST DOs

### Commenting and Variable Assignment Conventions

- All functions have a function comment definition
- Comments only when code is not self explanatory
- Variable assignments and defintions do not need to be aligned and should have single spaces between each other. For example,

```ts
const someVariable: {
    placeType: sublet.placeType ?? 'entire',
    roommates: sublet.roommates ?? 0,
    address: sublet.address,
};
```

NOT

```ts
const someVariable: {
    placeType:         sublet.placeType         ?? 'entire',
    roommates:         sublet.roommates          ?? 0,
    address:           sublet.address,
};
```

## Project Plan

Continue from .claude/plans/PLAN.md
