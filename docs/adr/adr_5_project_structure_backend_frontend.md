# Architectural Decision Record (ADR) Template

Title: Restructing Project Monorepo -

Date: 09/25/26

Status: accepted

## Summary:

Issue and Context:

> While being in the same repo, the backend and repo root are two fully independent npm projects.

Decision:

> Concise description

## Details

### Context and Problem Statement

> Currently, both the project's frontend and backend are in the same repo but their npm project scopes are different. The root package.json and backend package.json are two fully separate npm projects with no workspaces field. Now that backend is being added, there are shared data (e.g. TypeScript types) that requires a one source of truth. Need to decide should they be linked within one repo they already share so code can go between them safely? If so, how invasive should linkage be, and when is the cheapest time to do it?

## Considered Options

1. **Don't Link**
   - Roadmap
     - N/A
   - Pros
     - No migration cost
   - Cons
     - Inevitable duplicate data when a shared type, for example, needs to reach across the projects
     - Vercel's monorepo build-skipping (only unaffected projects rebuild) requires a package-manager workspace declaration — without one, an unrelated backend/ commit could trigger a full, unnecessary frontend rebuild.
     - Incompatible tsconfig settings would raise errors
2. **Npm Workspaces with Shared Package**
   - Roadmap
     - Add workspaces field to root pacjage.json
     - Add one new packages/shared folder
     - `tsx import {Sublet} from '@sublet-nu/shared' `
   - Pros
     - Simplier to implement (use npm workspaces with shared package to avoid duplication)
     - Solves type-sharing problem
   - Cons
     - Potential confusion due to the root package.json acting as Next.js guide and as the workspace root
     - Potential interdependencies
3. **Full Mono Repo Restructure**
   - Roadmap
     - Root becomes only the workspace root: `workspaces: ["apps/*", "packages/*"]`
     - Move Nextjs app into `apps/frontend`, `backend/` into `apps/backend`, and extract shared type defintions into a new `packages/shared`
   - Pros
     - Project structure is clearer
     - Backend not built out yet, so restructure is easier to carry out now
   - Cons
     - One-time migration across entire project, need to update dependcies and references
     - Vercel dashbaord setting change needed so it knows where to pull the project

### Decision outcome

> [What is the change that we are proposing and/or doing?]

#### **Chosen option**: Full Mono Repo Restructure, because it handles incompatibilites between npm and root package.json by making a one-source-of-truth which resolves potential confusion on shared libs,data, types, etc.

### Consequences

> Have to restructure entire project, but will make backend and frontend structure and communication easier in the long run

## Revisit trigger

> If backend code expands, then decide if it needs its own package
> If CI wall-to-clock time becomes a measured bottleneck, revist using a task orchestrator

---

## Confirmation

**How will compliance with this ADR be verified?**

> Full lint/typecheck/test/build green off one clean install; An actual docker build + container run, not an assumed-correct Dockerfile; A real Vercel preview deploy succeeding post-Root-Directory-change; Zero cross-app relative imports (grep-verified)

- `npx tsc --noEmit`, `npm run lint`, `npx vitest run`, and `npm run build` all pass from
  a clean `npm install` at the repo root (single lockfile, single install, covering both
  workspace members).
- `docker build` and `docker compose up prod` (or `dev`) actually run and serve the app —
  not merely assumed to work because the Dockerfile "looks right."
- A real Vercel preview deployment succeeds after the Root Directory setting is updated.
- `grep -rn "\.\./\.\./" apps/` (or equivalent) turns up zero cross-app relative imports —
  everything crossing the `apps/frontend` ↔ `apps/backend` boundary goes through
  `packages/shared` by package name.
- `CLAUDE.md`'s "Key Files and directories" table and `README.md`'s "Project Structure"
  section both match the actual, current directory layout — read them fresh, don't trust
  that "the code moved so the docs must be fine."
