# SubletNU Security Audit

**Audit date:** 2026-10-28  
**Branch:** `security-audit-2026-10-28`  
**Scope:** Frontend, backend database code, infrastructure configuration, dependencies, secrets, and repository configuration  
**Status:** Findings documented; remediation not implemented  
**Purpose:** Implementation handoff for future security work

## Executive summary

The repository currently contains a mostly complete frontend prototype and partial backend foundations, but it is not production-ready for real student accounts or sensitive data.

The highest-priority concerns are:

1. Authentication and authorization are simulated rather than implemented.
2. `next@16.2.3` is affected by multiple dependency advisories and should be upgraded promptly.
3. Production security headers and route protection are not configured.
4. Mock listing, profile, match, message, and address data is exposed to the browser bundle because it is currently used as application data.
5. Database authorization needs database roles, session-scoped queries, and server-side enforcement when real data is introduced.
6. The dependency audit reports 7 production vulnerability findings: 1 critical, 5 high, 1 moderate.

No live secrets or private key material were found by the repository secret-pattern scan. The CI database credential is for an isolated disposable database only and should remain clearly distinguished from production credentials.

## Current technology versions

- Next.js: `16.2.3`
- React: `19.2.4`
- React DOM: `19.2.4`
- Node: CI currently uses Node 24
- PostgreSQL local/CI: 17 with PostGIS 3.5
- Frontend framework: Next.js App Router

---

## Finding 1: Authentication is not implemented

### Evidence

- `apps/frontend/app/lib/mock-data.ts` defines a fixed `CURRENT_USER_ID = 'user-jon'`.
- Login and signup forms perform only client-side validation and do not establish a session.
- The login prototype explicitly reports that authentication is not wired up.
- Route groups named `(logged_in)` contain dashboard routes, but there is no middleware, proxy, auth session provider, token validation, or server-side session check.

### Sensitive data exposed if used

If account routes or real data are deployed without authentication:

- Another student could view listings, request or match records, favorites, notifications, profile settings, private addresses, and messages.
- Changing a route ID could expose another student's data if query authorization is not enforced in SQL.
- Student names, university email addresses, exact addresses, coordinates, and private messages could be disclosed.

### Effects if implemented correctly

- Every account action is associated with a verified server-side session.
- `@u.northwestern.edu` accounts are restricted where intended.
- Listing ownership, message participation, match participation, favorites, and profile updates are authorized independently of UI state.
- Unauthorized users receive `401` or `403` responses rather than another user's data.

### Effects if left unused

- Existing prototype pages appear protected by folder names only.
- Any future API or database integration could accidentally treat client-supplied IDs as identity.
- Security controls in UI components, mock comparisons, or JavaScript filters would be bypassable.

### Recommendation

Implement a real authentication provider before connecting real data. Recommended minimum controls:

- Use server-side session verification on every protected route and server action.
- Derive the user ID from the verified session; never accept it from a hidden form field, query parameter, or request body.
- Validate `@u.northwestern.edu` server-side during authentication.
- Use secure, HTTP-only, SameSite cookies.
- Define an authorization error convention before implementation:
  - `401` when no valid session exists.
  - `403` when the user exists but lacks permission.
  - `404` only when hiding an unauthorized object is intentional.
- Add authorization coverage for ownership and participant relationships.

### Implementation acceptance criteria

- An unauthenticated request cannot access dashboard, listings management, requests, favorites, settings, messages, or match details.
- A student cannot edit, archive, delete, confirm, or cancel another student's record by changing an ID.
- A student cannot read another participant's thread or message.
- A non-Northwestern email cannot pass server-side validation.

---

## Finding 2: React and Next.js dependency vulnerabilities

### Current state

- Installed Next.js: `16.2.3`
- Installed React: `19.2.4`
- Installed React DOM: `19.2.4`
- `npm audit --omit=dev` reported 7 vulnerabilities:
  - 1 critical
  - 5 high
  - 1 moderate

The audit's direct Next.js advisory set includes denial of service, middleware/proxy authorization bypasses, server-side request forgery, cache poisoning, cross-site scripting, information disclosure, and remote code execution advisories affecting image handling or framework features.

### Which findings should be treated as real risks

The package is not automatically vulnerable to every advisory. Applicability depends on the deployment platform and feature usage. Still applicable risk areas include:

- The App Router and Server Components
- Image optimization
- Server Actions or framework actions if enabled
- Middleware or proxy route protection
- Custom servers or nonstandard rewrites
- Cached or dynamic rendered pages
- SVG, AVIF, or image-response features

npm's recommended upgrade is to `next@16.4.3` at audit time.

### Potential effects of upgrading Next.js

Next.js and React are coupled even when React appears unchanged. An upgrade can affect:

- App Router rendering behavior
- Server Component and Server Action internals
- Middleware/proxy APIs and deprecation behavior
- Image optimization behavior and allowed remote image sources
- Cache components and dynamic rendering boundaries
- Route status codes, streaming, and prefetch behavior
- Standalone output and Docker tracing
- Framework peer dependencies for React
- React DOM hydration and compatibility

Because AGENTS.md states that this is not a generic Next.js version, the migration must follow the guides under `node_modules/next/dist/docs/` rather than relying only on training-data conventions.

### Effects if the Next.js upgrade is not applied

- Known framework advisories remain in production dependencies.
- Vulnerable framework paths remain reachable longer.
- The security posture deteriorates if public deployment or real server-side features are added.
- A later upgrade becomes larger because framework behavior may continue changing.

### React upgrade effects on the codebase

React is already `19.2.4`, so an npm patch update would usually have lower risk than a major React migration. Most code uses ordinary React APIs and should remain compatible.

Potential areas affected by a framework-supported React update:

- Hook behavior and effect timing
- Strict Mode duplicate-effect behavior
- Hydration mismatches between server and client components
- Ref callbacks and object refs
- Third-party UI library peer dependencies
- Context providers and state updates
- Browser APIs wrapped in Leaflet, notifications, responsive hooks, and dialogs
- `react-leaflet`, `react-responsive`, Radix, `react-day-picker`, and other installed peer dependencies

Potential incompatible or fragile patterns to search for during implementation:

- `useEffect` used as a state synchronization mechanism
- State updates during render
- External-store subscriptions implemented manually
- Components relying on incidental render order
- Wrong assumptions about strict development rendering
- Mutating browser libraries during server rendering
- Client components importing server-only browser/React behavior

### React update effects if not applied

- React-specific advisories or compatibility fixes will remain unresolved.
- Current third-party packages may not be compatible with future framework upgrades.
- Patch updates missed now may accumulate breaking changes later.

### Recommended implementation plan

1. Create a separate dependency upgrade branch; do not combine it with authentication changes.
2. Upgrade Next.js using npm workspace dependencies and lockfile updates.
3. Upgrade React and React DOM only if npm or Next.js requires a different peer version.
4. Upgrade the `eslint-config-next` package to the matching framework version.
5. Review breaking changes using the installed Next.js documentation rather than external assumptions.
6. Run frontend build, typecheck, lint, tests, and production start.
7. Run npm audit again.
8. Manually test the high-risk rendering and browser-only areas listed in the validation section.

### Suggested validation commands

```text
npm install
npm run typecheck --workspace=apps/frontend
npm run lint --workspace=apps/frontend
npm run test --workspace=apps/frontend
npm run build --workspace=apps/frontend
npm audit --omit=dev
npm list next react react-dom --depth=0
```

No version upgrade should be considered complete until the audit and full frontend suite pass or remaining advisories are explicitly reviewed.

---

## Finding 3: Mock sensitive data is included in client bundles

### Evidence

- `apps/frontend/app/lib/mock-data.ts` exports exact addresses, coordinates, listing data, user profiles, match requests, threads, messages, notifications, and the fixed current user.
- Many client components import mock collections directly.
- The current build and route payloads can include mock address and match information.

### Effects if real data is copied into the same pattern

- Browser JavaScript and Next.js page payloads could expose exact student addresses, university emails, private requests, and conversations.
- Hiding data from a React component would not remove it from serialized props or generated JavaScript chunks.
- Search requests or static generation could cache user-specific data.

### Effects if removed before real backend integration

- Client bundles contain only public data received from approved server queries.
- Exact addresses are never serialized except for an owner or confirmed renter.
- Mock-only data is clearly separated from production data and tests.

### Recommendation

Before real data integration:

- Remove or isolate mock data behind explicit prototype-only imports.
- Never import production repositories, exact addresses, or private data into Client Components.
- Use `toPublicSublet()` or an equivalent server-produced public response for browse and public profile data.
- Return exact addresses only after server-side ownership or confirmed-match authorization.
- Avoid static rendering or long caching of account-specific routes.

### Address privacy rule

Browse/search endpoints must expose only:

- Public-safe approximate street or block representation
- Approximate coordinates
- City and public listing details

Exact `streetAddress` and precise coordinates must be returned only when:

- The session user owns the listing; or
- The session user is the confirmed renter.

---

## Finding 4: Account routes lack route protection and security headers

### Evidence

- No middleware or proxy file exists in the frontend workspace.
- `apps/frontend/next.config.ts` does not configure security headers.
- No CSP, HSTS, frame protection, MIME-sniffing protection, permissions policy, or Referrer-Policy configuration was found.
- Route folders do not themselves constitute an authentication boundary.

### Effects if implemented

- Account routes reject unauthenticated users before rendering.
- CSP reduces script injection impact.
- HSTS encourages HTTPS-only transport.
- Clickjacking and MIME-sniffing risks are reduced.
- Sensitive responses are less likely to appear in referrer or cross-origin contexts.

### Effects if left unused

- Client-only route protection remains bypassable with direct requests or modified navigation state.
- Production headers may remain at framework defaults.
- Session cookies and browser state do not receive an app-specific security policy.

### Recommendation

Add route protection and headers after authentication is selected. Suggested headers:

```text
Strict-Transport-Security
Content-Security-Policy
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy
```

The CSP must be tailored to framework requirements, local development, maps, fonts, images, analytics, and authentication providers. Do not copy a permissive wildcard CSP without reviewing every source.

Add rate limiting for authentication, password reset, listing creation, search, uploads, messages, and match transitions when they become server endpoints.

---

## Finding 5: Database access still lacks role separation and session-scoped repositories

### Evidence

- Browse/search correctly uses parameterized SQL and queries the `public_sublets` view.
- The public view excludes exact address and private-row data.
- Repository comments warn that dedicated column privileges are not implemented yet.
- Ownership and participant repositories are planned but not implemented for real mutations.
- No live user/message API currently performs SQL authorization checks.

### Effects if used without scope

- A request user could read another student's matches, threads, messages, profile, settings, or exact address.
- A listing edit or state transition could be accepted by guessing or supplying another owner's ID.
- A public-safe view alone would not protect tables, message tables, match tables, or mutation endpoints.
- SQL errors or database exceptions could reveal implementation details if exposed directly to users.

### Effects if implemented correctly

- Public browse queries can return only public-safe rows.
- Message reads and writes include the session participant ID in SQL.
- Address reads include owner or confirmed-renter conditions in SQL.
- Listing mutations verify ownership in SQL.
- Match transitions verify the expected state and use row locks inside transactions.
- Least-privilege database roles reduce the damage from a query-layer compromise.

### Recommendation

- Keep raw parameterized SQL in repositories; never build SQL using untrusted string concatenation.
- Do not use `SELECT *` in application queries.
- Create separate roles for migrations, public browse/read, authenticated application operations, and restricted administrative operations if budget and architecture allow.
- Use session user IDs in every query that touches private addresses, messages, matches, notifications, or profile settings.
- Run match state transitions in transactions with row locking.
- Validate all enums, dates, IDs, page sizes, search lengths, rent ranges, and file metadata before querying or as close to the database boundary as possible.
- Map database and repository errors to safe user-facing messages.

### SQL/data tests required

At minimum, repository and browser tests must cover:

- Happy path
- Validation failure
- Authorization failure
- Illegal state transition
- Another student's listing ID
- Another student's match or thread ID
- Exact-address disclosure prevention
- Northwest email/domain restriction

---

## Finding 6: Infrastructure is currently limited but needs review before expansion

### Evidence

The current CDK stack creates billing alerts and budgets only. No public RDS, Lambda, API Gateway, S3, application load balancer, NAT gateway, or production database exists yet.

CDK review found:

- SNS publishing is restricted to the AWS Budgets service principal and account.
- No wildcard IAM resource or public security-group finding was found in the current stack.
- No new CloudWatch log groups were found in the current synthesized scope.

### Effects if expanded without controls

- An Internet-facing RDS instance could expose student addresses and private messages.
- Wildcard IAM permissions could increase the impact of compromised functions.
- Public S3 buckets could expose uploaded identity documents, photos, or message media.
- Missing log retention could create avoidable cost and retention risk.
- Replacement of a stateful resource could cause data loss.

### Mandatory infrastructure controls

- Do not provision NAT Gateway, Application Load Balancer, Multi-AZ RDS, provisioned Aurora, or always-on compute without explicit approval and monthly cost comparison.
- Every new AWS resource must include an estimated monthly cost in the PR.
- Every CloudWatch log group needs explicit retention.
- Keep RDS private, encrypted, non-publicly accessible, and reachable only through restricted security-group rules.
- Block public S3 access, enable encryption, and use least-privilege object paths.
- Narrow IAM actions and resources; avoid wildcard actions and resources unless they are explicitly unavoidable.
- Tag resources with the project name.
- Review CDK diffs for replacements and stateful-resource deletion policies.

---

## Finding 7: Secrets, credentials, and CI configuration

### Secret scan

The tracked-source scan found no private keys or real cloud/API credentials. It found generic database connection strings in:

- `.env.example`
- `.github/workflows/ci-backend.yml`
- `apps/backend/README.md`
- `docker-compose.yml`

### Risk assessment

The CI credential `postgres://postgres:postgres@localhost:5432/sublet_nu_test` protects a disposable database and is not a production secret. It should remain isolated from production networks and data.

`.env.example` intentionally contains placeholders. Real secrets should never be committed.

### Effects if real credentials are added incorrectly

- Database credentials could be used from forked repositories, logs, shell history, pull requests, or deployment artifacts.
- AWS credentials could enable billing changes, data access, resource provisioning, or account compromise.
- Authentication provider secrets could allow account takeover or token generation.

### Recommendation

- Keep `.env.local` ignored; only commit `.env.example` placeholders.
- Store production secrets in the deployment platform's secret manager or environment-variable configuration.
- Never place secrets in CDK context, Dockerfiles, git history, source maps, or client-side environment variables.
- Use rotation procedures if a credential is ever exposed.
- Consider secret scanning in GitHub Actions.
- Do not expose variables beginning with public `NEXT_PUBLIC_` unless they are intended for every browser.

---

## Priority remediation plan

### Phase 0: Dependency and Next.js upgrade

1. Add a dependency lockfile update for Next.js `16.4.3` or a subsequently verified fixed version.
2. Keep React `19.2.4` unless Next.js/npm reports an incompatible peer requirement.
3. Upgrade `eslint-config-next` to the same framework line.
4. Run the complete frontend validation suite.
5. Run build and runtime smoke tests.
6. Repeat `npm audit --omit=dev`.

### Phase 1: Remove prototype identity and mock private data

1. Replace `CURRENT_USER_ID` with verified session identity.
2. Remove real-sensitive imports from client components.
3. Convert browse and profile data to public response shapes at the server boundary.
4. Ensure no exact address reaches static page payloads, browser bundles, or public API responses.

### Phase 2: Implement authentication

1. Select NextAuth or an equivalent documented provider.
2. Enforce `@u.northwestern.edu` server-side.
3. Implement secure session cookies and logout.
4. Add route protection before rendering protected pages.
5. Add authenticated server actions or API handlers.

### Phase 3: Implement repository authorization

1. Build `UserRepository`, `ListingRepository`, `MatchRepository`, and `MessageRepository` according to `.claude/docs/sql.md`.
2. Use parameterized SQL for every untrusted value.
3. Scope private addresses, messages, threads, matches, notifications, and profile settings in SQL by session user ID.
4. Add transaction and row-lock handling for match transitions.
5. Add database role separation and least privilege.

### Phase 4: Browser and infrastructure controls

1. Add CSP and security headers.
2. Add rate limiting and safe error responses.
3. Configure CORS narrowly if a separate frontend/backend origin is used.
4. Configure S3 upload controls for future photo/media work if needed.
5. Before provisioning RDS or Lambda infrastructure, complete cost and IaC reviews.

### Phase 5: Security regression coverage

Required tests for every protected behavior:

- Happy path
- Validation failure
- Authorization failure
- Illegal state transition
- Cross-user ID substitution
- Private address disclosure prevention
- Email-domain enforcement
- Participant-only message access

---

## Manual validation checklist after framework or auth changes

### Framework rendering

- Home, browse, listing detail, dashboard, favorites, listing edit/new, requests, messages, profile, settings, login, and signup routes render successfully.
- No hydration warning appears in browser development tools.
- The map initializes after hydration and does not run server-only browser APIs.
- Dialogs, menus, tabs, switches, carousel controls, and form validation work.
- Image optimization does not expose or fetch unintended origin images.
- Standalone Docker build and production start remain functional.

### Authentication

- Directly visiting protected routes without a session returns unauthorized.
- Directly visiting protected routes with an invalid or expired session returns unauthorized.
- Cross-user route IDs do not reveal private data.
- Non-Northwestern accounts are rejected server-side.

### Data privacy

- Browse responses contain no exact street address or precise coordinate.
- Listing detail responses reveal exact addresses only to owners or confirmed renters.
- Messages contain only rows shared by the participant IDs.
- Match counts cannot reveal another user's private list.
- Static generated output contains no account-specific data.

### Infrastructure

- IAM resources are purpose-specific and wildcards are reviewed.
- RDS is encrypted and not public.
- Security groups do not allow unrestricted application/database inbound traffic.
- Log groups have retention periods.
- S3 blocks public access and controls object access.
- CDN/API CORS settings allow only the intended frontend origin.
- A CDK diff contains no accidental stateful resource replacement.

---

## Suggested issue breakdown

1. `security/upgrade-nextjs-and-react-peer-dependencies`
2. `security/remove-mock-sensitive-data-from-client-bundle`
3. `security/implement-server-session-authentication`
4. `security/enforce-northwestern-email-domain-server-side`
5. `security/add-route-protection-and-security-headers`
6. `security/scoped-listing-address-authorization`
7. `security/scoped-match-repository-and-state-machine`
8. `security/scoped-message-repository`
9. `security/add-private-data-regression-tests`
10. `security/harden-cdk-and-deployment-infrastructure`
11. `security/add-dependency-and-secret-scanning-ci`

## Explain-back requirements before merge

Before this work merges, record every non-obvious decision in `EXPLAIN_BACK.md`, including:

- Which React/Next.js versions were selected and why.
- Why any framework compatibility change was required.
- Authentication provider choices and session behavior.
- Authorization ownership and participant rules.
- Exact-address privacy implementation.
- Database role and privilege choices.
- Security-header and CSP decisions.
- Rate-limit scope and failure behavior.
- Error responses and information-disclosure risks.
- AWS resources, IAM permissions, security groups, encryption, retention, and cost estimates.

## Final recommendation

Do not deploy real student accounts or private listing, message, match, or address data until authentication, SQL-scoped authorization, address privacy, security headers, and dependency upgrades are implemented and tested.
