# Security Review — run before every merge that touches data or infrastructure

## The five questions

1. **What could leak here?** Name the specific field. "An address" is a finding;
   "data" is not.
2. **Is authorization enforced in the query?** A `WHERE` clause the user can't
   influence, not a filter applied to results already fetched.
3. **Is anything scoped to `*`?** IAM actions, IAM resources, CORS origins, S3
   bucket policies.
4. **What does this return on failure?** Stack traces, SQL errors, and "user not
   found" vs "wrong password" are all information disclosure.
5. **Could a logged-in student reach another student's row by changing an ID in
   the URL?** Test it manually before merging.

## SubletNU-specific

- A listing's exact address must not be returned by the browse/search endpoint —
  only after a match is confirmed. Verify the API response shape, not just the UI.
- Message threads: every read scoped to `participant_id = :sessionUserId`.
- The Northwestern domain restriction (`northwestern.edu` and any subdomain) is enforced server-side at token
  validation. Client-side checking is a UX nicety, not a control.
- Presigned upload URLs: scoped to one key prefix, short expiry, size-limited.
- JWTs: `iss` pinned to the user pool; access tokens pin `client_id` + `token_use`, ID tokens pin `aud`; RS256 only; `exp` required (`apps/frontend/app/lib/auth/tokens.ts`).
- `proxy.ts` matcher: explicit static allowlist, never extension-based. Server Actions call `requireSession()` themselves.
- Run `npm audit --omit=dev` before merging; any `next` advisory mentioning Proxy/Middleware bypass is a blocker.
