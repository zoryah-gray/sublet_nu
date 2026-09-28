# EXPLAIN_BACK — refactor/monorepo-restructure

Not committed, per standing instruction. Local only — paste into the tutoring chat when ready.

## 1. Why `packages/shared` contains exactly `Quarter`, `SubletDisplayStatus`, `Sublet` — nothing more

These are the only types actually *on* the `Sublet` interface that also matter to the DB schema (`.claude/docs/sql.md` requires Postgres enums to match a TypeScript union one source of truth). Everything else considered and rejected:
- `SubletStatus` — not a stored field. It's a UI label *derived* from `displayStatus`/`isDraft` by `deriveSubletStatus()` in `apps/frontend/app/lib/utils.ts`. Grepping `apps/backend` for any import of `utils.ts` returned zero matches before this branch, so there's no concrete backend consumer to justify moving either the type or the function.
- `MatchStatus` — belongs to `MatchRequest`, not `Sublet`. Associated only indirectly (a sublet can have match requests against it), which isn't the same as being a `Sublet` field.
- `QUARTER_COLORS`/`SUBLET_STATUS_STYLES`/`SUBLET_STATUS_LABELS`/`MATCH_STATUS_STYLES`/`MATCH_STATUS_LABELS` — Tailwind class strings. A CDK backend has no use for these; moving them would leak a UI concern across the app boundary the restructure exists to draw cleanly.

`app/lib/definitions.ts` re-exports `Sublet`/`Quarter`/`SubletDisplayStatus` from `@sublet-nu/shared` rather than each of the ~10 consumer files importing from the new package directly — this kept the diff to a type-and-data-shape change only; zero import statements needed touching anywhere in `apps/frontend/app/`.

## 2. `Sublet.coords`: `LatLngExpression` → `{ lat: number; lng: number }`

Your call, confirmed before implementation: a DB-facing shared type shouldn't reference a browser mapping library's type at all, even just for typing. Real impact, verified by actually running `tsc`:
- `apps/frontend/app/lib/mock-data.ts`'s 13 `coords: [lat, lng]` tuples → `coords: { lat, lng }` objects.
- `apps/frontend/__tests__/listing-card.test.tsx`'s one mock sublet, same conversion — this one wasn't in my original consumer grep (I'd only grepped `app/`, `components/`, `lib/`, not `__tests__/`) and only surfaced when `tsc --noEmit` actually failed on it. Fixed, then typecheck passed clean.
- Leaflet's own `LatLngLiteral` is `{ lat: number; lng: number }` — structurally identical — so `interactive-map.tsx`'s `position={sublet.coords}` needed zero code change. Grepped for positional `coords[0]`/`coords[1]` indexing repo-wide; none exist.

## 3. `outputFileTracingRoot` — a real, pre-existing bug found during research, not caused by this branch

Next.js's standalone tracing auto-detects its root by walking up the filesystem for lockfiles and does not stop at the first one — it keeps walking as long as it keeps finding more, using the outermost (`node_modules/next/dist/lib/find-root.js`). On this machine, `/Users/ryah/package-lock.json` (an unrelated lockfile) sits above the repo, so `next build` on `main` today already silently traces from `/Users/ryah` — visible in the old `.next/standalone/Documents/.../sublet_nu/server.js` nesting. I did not touch that file (outside the project, may be unrelated work). Fixed by setting `outputFileTracingRoot: path.join(__dirname, '../../')` explicitly in `apps/frontend/next.config.ts` — deterministic regardless of what lockfiles exist elsewhere on any given machine or in CI/Docker.

**Verified by actually building**, not guessed: `apps/frontend/.next/standalone/apps/frontend/server.js` is the real entry point, with hoisted `node_modules/` at the standalone root and `.next/static/` needing a separate manual `COPY` (standalone tracing intentionally excludes static assets — confirmed by inspecting the tree; `apps/frontend/.next/standalone/apps/frontend/.next/` has no `static/` dir). The Dockerfile's runner-stage `COPY`/`CMD` lines match this exactly.

## 4. `.dockerignore`: `apps/backend/**` excluded except `package.json`

Treated as a real security-adjacent check, not tidiness, per your instruction: this image only ever builds `apps/frontend`. Without this, `COPY . .` in the builder stage would pull AWS CDK source, `cdk.out`, and any `cdk.context.json` cache into the frontend image's build layers for no functional reason — `apps/backend/package.json` is the only file from that tree actually needed, so `npm ci` can validate the workspace lockfile against every member.

## 5. CI: what happens if a PR touches only `apps/backend`?

**Honest answer: `ci-frontend.yml` still runs, needlessly.** There is no `paths:` filter on the workflow's `on:` triggers — never was, and I didn't add one, since it wasn't in scope for this branch and the user's own gate question anticipated exactly this gap rather than asking me to silently fix it. A backend-only PR will currently still spin up all four frontend jobs (typecheck/lint/test/build) for no reason. Worth a follow-up (`paths: ['apps/frontend/**', 'packages/shared/**']`), but that's a scope decision for a separate change, not bundled into a structural move.

## 6. Pre-existing conditions found during verification, not caused by this restructure

Checked each against `main` (commit `a02b2e9`, this branch's merge-base) before flagging, per the "check baseline first" instruction:
- **`apps/backend`'s `npm test` fails**: `test/backend.test.ts` is fully commented out (confirmed identical content via `git show a02b2e9:backend/test/backend.test.ts` — byte-for-byte the same). Jest's "Your test suite must contain at least one test" failure is pre-existing, not a regression from the move.
- **`apps/backend`'s `cdk synth` fails**: a CDK CLI/library version mismatch (`aws-cdk` pinned at `2.1118.0`, `aws-cdk-lib`'s unchanged `^2.248.0` range resolved fresh to `2.271.0`, whose cloud-assembly schema the pinned CLI can't read). Neither version constraint was touched by this branch; a fresh `npm install` against `main`'s unchanged `backend/package.json` would hit the same drift today. Not fixed here — out of scope for a structural move, and not something to silently paper over with a version bump you didn't ask for.

## 7. `packages/shared` build strategy

Pre-built (`tsc` → `dist/` + `.d.ts`, `composite: true`), per your decision — avoids ts-jest's default `transformIgnorePatterns` skipping node_modules (which would include the workspace-symlinked shared package) and avoids needing `transpilePackages` on the Next.js side. Cost: editing shared types requires `npm run build --workspace=packages/shared` before the change is visible to either app — no watch-mode wiring for this yet (a normal monorepo-without-Turborepo tradeoff, flagged rather than solved here since Turborepo is explicitly deferred per the ADR).

## 8. Root `package.json` — kept genuinely empty

No scripts, not even a `build:shared` convenience wrapper, per your explicit "pure workspace root" instruction. The Dockerfile and CI both invoke `npm run build --workspace=packages/shared` directly rather than through a root-level indirection.

## 9. What I have not done, and you must do yourself

**Vercel dashboard → Project Settings → Root Directory → `apps/frontend`.** This is a dashboard setting, not a repo file — no commit changes it. Until it's updated, the next Vercel deploy will build from the (now nonexistent at root) old Next.js app location and fail with no code-level clue pointing at why.
