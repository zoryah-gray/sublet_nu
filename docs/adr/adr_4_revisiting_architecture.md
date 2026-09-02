# ADR 4 - Revisiting Deployment Architecture

Title: Deployment Architecture

Date: 08/31/26

Status:
proposed | rejected | **accepted** | deprecated

## Summary:

Issue and Context:

> ADR-2 chose Next.js as the frontend framework but never decided where it runs relative to the AWS backend the system design calls for.

Decision:

> Option 1: **Split — Vercel (Hobby tier) for the frontend, API Gateway + Lambda + RDS on AWS for the backend**

## Details

### Context and Problem Statement

The frontend (Next.js 16 / React 19, on mock data) exists. The backend (Postgres, Lambda, S3, SQS, SES per the system design doc) does not. Three shapes are possible for how the two connect, and the choice determines the deploy pipeline, the network topology, the cost, and how much of the AWS competency map the build actually exercises. The original Proposal PDF assumed "Vercel w/ backend via CDK to AWS" without comparing it to anything — this ADR reopens that as a deliberate decision.

Two hard constraints bound the option space, both already written into CLAUDE.md:

- RDS must sit in a private subnet with no public accessibility — access is by security group, not by public endpoint.
- This is a real product serving real Northwestern students' PII on a ~$30/month personal-account budget, not a lab exercise.

## Considered Options

1. **Split — Vercel (Hobby tier) for the frontend, API Gateway + Lambda + RDS on AWS for the backend**
   - Pros
     - Fastest path for the frontend half — git push to a PR gets a free preview URL automatically
     - Two independent deploy targets means a broken backend deploy can't take the frontend down and vice versa.
     - Docs & longevity: Vercel is built by the same company that builds Next.js itself
   - Cons
     - Vercel's Hobby plan is restricted to non-commercial, personal use under Vercel's fair use guidelines
     - Every server-side call from a Next.js route handler to the backend makes an extra public-internet hop (Vercel → API Gateway)
2. **All-AWS — Next.js itself deployed via OpenNext to Lambda + CloudFront + S3, in the same CDK app as the rest of the backend**
   - Pros
     - No Vercel bill at all.
     - Lambda, CloudFront, and S3 at beginner traffic level stay within free tiers
     - One CDK app, one CI/CD pipeline, one AWS bill, one console to watch, one place secrets live (all AWS-native — no separate Vercel env-var store to keep in sync)
     - OpenNext for AWS is used in production
     - Switching cost later is low, in either direction
   - Cons
     - Loses Vercel's free, automatic preview-URL-per-PR — reproducing that (a per-branch preview stack) is real extra IaC work
     - Steepest first-deploy learning curve
     - Docs & longevity: OpenNext is MIT-licensed, ~5,000 GitHub stars, maintained by SST (a separate company/community from Vercel, not the Next.js core team) — actively maintained (v4.0.3 as of mid-2026, 53 open issues, healthy for a project this size) but structurally a step behind: it has to adapt to each new Next.js release rather than ship alongside it
3. **Next.js-as-backend — route handlers/server actions call RDS directly; AWS only holds S3, SQS, SES**
   - Rejected outright, but listed as it is an option
   - Pros
     - Fastest possible build
   - Cons
     - Vercel's lower tiers don't provide a static outbound IP, so the only way for a Vercel-hosted function to reach RDS is to make the database publicly reachable

### Decision outcome

#### **Chosen option**: Option 1 — Split (Vercel Hobby + AWS backend via CDK), because it keeps the first fullstack build's infrastructure surface manageable, costs $0 extra beyond the AWS backend, and doesn't foreclose moving to All-AWS later since OpenNext preserves the same build output.

> Vercel has a narrow commercial usage classification (payment processing, advertising a product/service for sale, being paid to build/host the site, affiliate linking as the primary purpose, ads, or even donation requests). SubletNU has none of these: no in-app payments (excluded from v1 scope by design), no ads, no affiliate links, no one being paid to build or host it, no donation ask. SO it qualifies as Hobby tier.
> **The one thing to hold onto:** this classification isn't permanent. If a donation button, an affiliate link, paid promotion, or any paid work on the project ever enters the picture, Hobby's terms are violated immediately — see the Revisit trigger below.

### Consequences

Easier

- Frontend deploys stay zero-config
- The root `package.json` (Next.js app) and `backend/package.json` (CDK app) staying as two separate projects — rather than merging into an npm-workspaces monorepo — is the right structure for this decision, since they deploy completely independently; no change needed there.

Harder

- Every server-side data fetch from a Next.js route handler or server component crosses the public internet to API Gateway — real latency (tens of ms, not disqualifying) and a real seam to secure (the Cognito-JWT-validating Lambda authorizer in ADR-3/system-design carries more weight here than it would in a same-stack deploy).
- Two dashboards, two places a bill or an outage can originate.

## Revisit trigger

Pull this decision forward — i.e., move off Vercel — if any of the following happens:

- Any feature requiring payment processing, ads, affiliate links, or donations is added (Hobby's terms are exceeded and need to switch tier to Pro)
- Vercel's fair-use team flags the account as an outlier usage pattern.
- Peak traffic approaches Hobby's typical-usage guidelines (100GB data transfer/mo, 1M function invocations/mo) — Y1 modeling in `adr_3_messaging_scope.md` puts SubletNU at roughly 180 peak monthly users, nowhere near this, so this is a distant trigger, not a near one.
- The competency-map goal (AWS reps) starts to feel shortchanged once the backend is stable — at that point, moving the frontend to OpenNext is a deliberate, scheduled exercise, not an emergency.

---

## Confirmation

`.claude/docs/cost-guardrails.md` should record this decision's cost basis (Hobby $0 + AWS ~$23–27/mo) so future sessions don't have to re-derive it. No CI assertion is needed the way ADR-3 has one (there's no CDK construct that would silently reintroduce Vercel Pro or an OpenNext deploy) — the check here is manual: revisit this file if the Revisit trigger above is hit.
