# Architectural Decision Record (ADR)

Title: Authentication — Cognito user pool, Google as the only IdP, Authorization Code + PKCE

Date: 11/01/26

Status: accepted

## Summary:

Issue and Context:

> `CURRENT_USER_ID = 'user-jon'` stands in for auth. PLAN.md §5 listed NextAuth. SubletNU needs real identities restricted to Northwestern accounts, a `users` row for every signed-in person, and no password storage.

Decision:

> Amazon Cognito user pool with Google federation as the sole sign-in path. The frontend uses the OAuth Authorization Code flow with PKCE against a public app client (no client secret). Two Cognito Lambda triggers enforce the email domain (PreSignUp) and create the `users` row (PostConfirmation).

## Details

### Context and Problem Statement

> The domain restriction must be a server-side control (`.claude/docs/security-review.md`), and user creation must happen exactly once, before the app ever sees the user. Budget is under $30/month.

## Considered Options

1. **Cognito + Google, Code + PKCE** (chosen)
   - Domain gate and provisioning run inside the auth system, before a token is issued, so no app code path can skip them.
   - No passwords stored anywhere; Google handles MFA and account recovery.
   - Free at our scale (Cognito Lite tier: 10,000 MAU free for direct and social sign-in).
   - Cost: AWS-specific; Cognito Lambda triggers have a hard 5 s deadline.
2. **NextAuth (Auth.js) with the Google provider**
   - Simpler frontend wiring, no AWS resources.
   - The domain check and user creation would live in Vercel functions. Backend Lambdas would then have to trust NextAuth-issued JWTs, which adds a second token issuer to secure.
3. **Cognito with native username/password**
   - Rejected: storing credentials is a liability with no benefit when every student already has a Google-backed Northwestern account.

## Decision Outcome

Option 1. Implemented in `apps/backend/lib/auth-stack.ts` and `apps/backend/functions/auth/`.

### Session design (frontend)

Hand-rolled with `jose`, no auth library. Cognito's access, ID and refresh tokens are stored as `HttpOnly`, `SameSite=Lax` cookies (`Secure` + `__Host-` in prod) for 5 days (`refreshTokenValidity`). `proxy.ts` verifies the access token's signature against Cognito's JWKS on every request: valid → proceed, expired → one silent refresh, anything else → sign out. Server Actions and data reads re-check via `app/lib/dal.ts`. Logout revokes the refresh token and ends the hosted-UI session.

### Consequences

- Good: one token issuer (Cognito) for every future API Gateway authorizer.
- Good: PreSignUp fails closed: unknown `ENVIRONMENT`, non-Google sign-up, unverified email, or wrong domain → rejected.
- Bad: if PostConfirmation fails, the user exists in Cognito with no `users` row, and Cognito won't re-run the trigger. Accepted, logged gap (PLAN.md §7).
- Bad: Lambdas in the VPC connect directly to the RDS instance. There's no connection pooling until RDS Proxy (deferred).

### Revisit when

- Non-Google sign-in is needed, or Cognito MAU passes the free tier.
- Concurrent DB connections from Lambdas approach the t4g.micro limit (~80): add RDS Proxy.
