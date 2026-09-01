# ADR 3 - Deciding user communication v1 scope

Title: User communication methods and notification delivery for v1

Date: 08/26/26

**Status**:
proposed | rejected | **accepted** | deprecated

## Summary:

### Issue and Context

> The original system design specifies API Gateway WebSockets for online notifications, SQS + Lambda + SES for offline notifications, and a real-time in-app messaging service with per-match message groups. Under a 2–3 week delivery window for a first production release, the WebSocket connection layer represents the largest schedule risk. Deciding what will ship in v1.

### Decision:

> Option 2: **Persisted messaging + polling**, WebSockets built with v2. Because with a latency requirement of under 1min, both op1 and opt2 allows it and with no real users yet, so the instant delivery option 1 allows is not worth the time constraints on a 2-3 week timeline.

**v1 (beta)**: persist messages and notifications in PostgreSQL; deliver in-app updates by client polling; deliver away-from-app updates by email via SQS → Lambda → SES.

**v2 (post-beta, committed)**: implement the WebSocket architecture as originally designed, reading the same tables.

## Details

### Context and Problem Statement

> [Describe the context and problem statement, e.g., in free form using two to three sentences or in the form of an
> illustrative story. What is the issue that we’re seeing that is motivating this decision or change?]

**What carries the conversation between the accept/confirm sublet status? How does a user learn that something has happened to their listing or request?.** Messaging is a require step since it hold weight in the matching pipeline. The system design specifies:

> userB accepts → _"matchRequest status changes to approved, and they go into talks (open a message chat group)"_ → **after talking**, userA, the owner of the sublet listing, clicks either confirm/approve or reject/close conversation → matchRequest status changes to confirmed (listing goes private) or declined

If nothing carries the "talking" step, the pipeline has a hole between _approved_ and _confirmed_, and the product does not work. Two students who have matched must be able to reach each other somehow before money and housing change hands.

That splits into two coupled sub-decisions:

|       | Question                                                                                            | Constraint                                              |
| ----- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| **A** | What medium carries the accept→confirm conversation?                                                | Must exist in v1 or the pipeline breaks                 |
| **B** | How is a user notified of a state change (request received, accepted, declined, listing withdrawn)? | Latency requirement is soft — this is housing, not chat |

They are coupled because in-app messaging and real-time notifications share the same WebSocket infrastructure. Choosing WebSockets for one makes the other nearly free; rejecting it for one makes it hard to justify for the other.

### Constraints

- **Timeline**: 2-3 weeks to first production; solo developer w/ outside work
- **Cost**: target is under $30/mon since this is an unfunded, personal project.
- **Users**: real NU students. Private messages and contact details are sensitive data. anything irreversible regarding disclosure is a one-way door.
- **Latency**: Latency requirement is soft. Minutes are acceptable, hours is not.
- **Existing Frontend**: the messaging UI already exists using mock data. The component setup/contract should be supported across versions. It should not need to change when v2 is implemeneted.

### Considered Options

1. **Full original design: WebSockets + in-app real-time messaging**
   - Roadmap: API Gateway WebSocket API, a connection table (DynamoDB) keyed by user, `$connect` / `$disconnect` / `$default` route handlers, SQS + Lambda + SES fallback for offline users, messages persisted to Postgres and pushed live.
   - Pros
     - Matches the system design as written; no divergence to document later.
     - Best user experience — messages and notifications appear instantly.
     - SES fallback path handles offline users cleanly.
   - Cons
     - Largest build surface in the entire backlog: Connection registration, stale-connection cleanup, reconnection with backoff, and fan-out to a user's multiple devices are each their own set of edge cases.
     - Requires a DynamoDB table, adding a second database in v1.
     - Connection state is a second source of truth that can drift from reality — a disconnect that never fires leaves a ghost connection and a message that silently goes nowhere.
     - Hard to test
     - Estimated 2-3 days to complete

2. **Persisted messaging + polling**
   - Roadmap: Messages and notifications stored in Postgres. Client polls a lightweight endpoint for unread counts and new messages. Email via SQS → Lambda → SES for anything the user should know about while away.
   - Pros
     - Works with existing UI works.
     - Postgres is already in the stack; no new database.
     - Message history is durable and queryable by construction — with WebSockets, persistence is a separate concern you have to remember to build.
     - Easy to test
     - Estimated half a day for the messaging read/write path.
     - Preserves the WebSocket path for v2 behind the same tables — v2 changes the transport, not the data model.
   - Cons
     - Delivery latency equals the poll interval. Feels dated next to a real chat app.
     - Polling has a scaling cost: every active client generates requests against API Gateway on a timer whether or not anything changed. At 30-second intervals this is a few dollars a month at modest usage, and it scales with users rather than with activity.
     - Needs care to avoid waste — pause polling on hidden tabs, back off when idle, return 304/empty cheaply.
3. **No in-app messaging; reveal contact details on accept**
   - Roadmap: On acceptance, each party sees the other's @u.northwestern.edu address and the conversation moves to email. Notifications by SES only.
   - Pros
     - Cheapest and fastest to implement
     - Students already actively use their emails
   - Cons
     - **Sensitive Info Disclosure**. Once an address is revealed it cannot be unrevealed, and the accept action becomes higher-stakes than intended. For a marketplace holding student contact data this is a one-way door and a privacy exposure
     - No record of conversation, so disputes are unresolvable (e.g. 'they said utilities were covered in the lease').
     - Discards existing UI
     - Removes apps reason for the accept to confirm pipeline. Marketplace becomes more of a directory.
4. **Server-Sent Events from a Next.js route handler**
   - Roadmap: Keep messages in Postgres; push updates over a one-way SSE stream instead of WebSockets.
   - Pros
     - Simpler than WebSockets — one-way, plain HTTP, automatic browser reconnection.
     - No API Gateway WebSocket API and no connection table.
   - Cons
     - SSE fits serverless badly. The connection is held open, and serverless platforms bill for execution duration and cap it. This works against the entire cost argument for a serverless architecture.
     - Would need a persistent process (ECS/Fargate) to do properly, reintroducing always-on compute cost.
     - Still needs a fan-out mechanism to reach the right open stream from a Lambda that just wrote a row.

## Decision outcome

> [What is the change that we are proposing and/or doing?]

### **Chosen option**: Option 2 - Persisted messaging + polling, because it satisfies the latency requirement and is a reasonable build for v1 of the application, also option1 and option 2 cost roughly the same amount at predicted volume.

#### v2 Scope

After the beta test, v2 will build the WebSockets in. The v1 schema must support v2 because it will read from the same tables.

### Consequences

> [What becomes easier or more difficult to do because of this change?]

**Easier to do**: Single datastore, notification path is decoupled so delivery can change without touching the business logic.

**Harder to do**: message typing indicators, read receipts, delivery bounded by the poll interval

**Required mitigations** _(requirements, not nice-to-haves)_

- Polling **must** pause on `document.visibilityState === 'hidden'`. Without it, an open background tab generates ~960 requests/user/day, needlessly consuming battery and mobile data.
- The poll endpoint must be cheap: an indexed lookup returning an unread count or `max(created_at)` watermark, never a full thread fetch.
- Exponential backoff when the user is idle.
  **Schema requirements** _(binding, given the v2 commitment)_
- `notifications` — `user_id`, `type`, `payload`, `created_at`, `read_at`. Written on **every** match state transition regardless of delivery mechanism.
- `messages` — `thread_id`, `sender_id`, `body`, `created_at`.
- `message_threads` — created on `accepted`, linked to the `match_request`.
- **Delivery transport must not appear in any table.**

## Revisit trigger

Because v2 is committed, these triggers mean **pull v2 forward**, not reconsider the decision:

- Peak concurrent active users exceeds **~500**.
- Median time from `accept` to first message exceeds **2 hours**, indicating latency is suppressing engagement.
- Users report missed or late notifications more than once per 100 matches.
- Any feature is requested that genuinely requires live transport.
  Polling cost is deliberately **not** a trigger — Appendix A.3 shows it cannot plausibly become one.

## Confirmation

- No WebSocket construct in the v1 CDK stack. Asserted in CI via `cdk synth` grep for `AWS::ApiGatewayV2::Api` with `ProtocolType: WEBSOCKET`.
- `notifications`, `messages`, `message_threads` exist with the shape above and contain **no transport-specific column** — this is the v2 precondition.
- An integration test asserts a `notifications` row is written on every match state transition.
- A frontend test asserts polling halts when `document.visibilityState` becomes `hidden`.

---

# Appendix A — Cost basis

Every figure below derives from one number: **peak-month concurrent active users.** Sizing detail beyond what produces that number is omitted as non-load-bearing.

## A.1 Derivation

| Step                                                       | Value                                 | Basis                                                                                                       |
| ---------------------------------------------------------- | ------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Total students, all levels                                 | ~23,000                               | NU institutional figures                                                                                    |
| Undergraduate enrollment, fall 2025                        | **8,997**                             | [NU University Enrollment][1]                                                                               |
| Enrollment trend 2021→2025                                 | 8,458 → 8,611 → 8,776 → 8,995 → 8,997 | [_ibid._][1] — **flat**; +2 students last year. The market does not grow; all projected growth is adoption. |
| Juniors + seniors (only cohort permitted off campus)       | ~4,500                                | Two-year on-campus residency policy, even class distribution                                                |
| Off-campus leaseholders (~70% move off)                    | **~3,150**                            | Bounds supply — no lease, no listing                                                                        |
| Addressable market/yr, incl. graduate students and seekers | **~5,700**                            | ~25% of the student body                                                                                    |
| Peak-month active users, Y1 / Y2 / Y3                      | **180 / 500 / 865**                   | 8% / 22% / 38% adoption; ~40% of annual activity in the Feb–Apr summer-sublet peak                          |

**Seasonality basis.** Evanston leases run 12 months against a ~9-month academic year; that structural gap concentrates demand into Feb–Apr. Study abroad reinforces the pattern — [63% of study-abroad participants went in fall quarter 2023][2] — but supplies only ~13% of listings and is not load-bearing here.

> ⚠️ The 63% figure is a **term-distribution share of study-abroad participants, not of the student body.** The source presents it under _"When do students study abroad?"_ The literal reading would put 5,668 undergraduates abroad in one quarter, against the same office's confirmed 1,101 for a full year plus summer. Recorded so the error is not re-derived.

## A.2 Cost by option

6 sessions/user/month, ~15 min each. Baseline infrastructure ≈ $23/month, identical across all options.

| Option               | Marginal driver                                               | Y1     | Y3          | **Total Y3** |
| -------------------- | ------------------------------------------------------------- | ------ | ----------- | ------------ |
| **1 — WebSockets**   | 16K → 78K connection-minutes @ $0.25/M + small DynamoDB table | ~$1.00 | ~$1.30      | **~$24.30**  |
| **2 — Polling**      | 32K → 156K requests @ $1.00/M (HTTP API)                      | ~$0.03 | ~$0.16      | **~$23.20**  |
| **3 — Email reveal** | SES only                                                      | ~$0.10 | ~$0.10      | **~$23.10**  |
| **4 — SSE**          | 486K → 2.34M GB-seconds of held-open Lambda vs. 400K free     | ~$1.43 | **~$32.26** | **~$55.30**  |

**Cost does not discriminate between Options 1, 2, and 3 — all within $1.20/month. It decisively rejects Option 4.**

## A.3 Sensitivity — why sizing precision doesn't matter

The sizing carries real uncertainty (graduate-student sublet propensity is the softest input). It does not matter, because every conclusion survives a large error:

| At Y3 peak                   | 865 users (modelled) | 3× (2,595) | 10× (8,650) |
| ---------------------------- | -------------------- | ---------- | ----------- |
| Polling cost                 | $0.16                | ~$0.47     | ~$1.56      |
| WebSocket cost               | ~$1.30               | ~$2.00     | ~$5.00      |
| SSE cost                     | ~$32                 | ~$110      | ~$390       |
| DB load (queries/sec)        | ~2                   | ~6         | ~20         |
| Lambda concurrent executions | ~0.1                 | ~0.3       | ~1.0        |
| **Conclusion**               | unchanged            | unchanged  | unchanged   |

At 10× the model, peak concurrent users would exceed the entire off-campus undergraduate population — physically impossible at Northwestern. **The binding constraint is the size of the university, and the university is small.** Precision in the sizing was never going to change the answer.

## A.4 Polling concerns, sized

| Concern                                        | At NU scale                                                                       | Binds at                                        |
| ---------------------------------------------- | --------------------------------------------------------------------------------- | ----------------------------------------------- |
| Cost                                           | ~$0.16/mo at Y3                                                                   | ~5M polls/mo                                    |
| Database load                                  | ~2 queries/sec peak — trivial for `db.t4g.micro`                                  | ~200 queries/sec                                |
| Lambda concurrency / RDS connection exhaustion | ~0.1 concurrent executions; polls are too short to sustain concurrency            | ~2,000 concurrent pollers → RDS Proxy (~$11/mo) |
| Wasted work                                    | Mitigable in hours: cheap indexed query, ETag/304, visibility pause, idle backoff | —                                               |
| **Stale/open connections**                     | **Does not apply** — polling is stateless HTTP                                    | n/a (Option 1 only)                             |

Every polling concern either does not bind at Northwestern's scale or has a known mitigation costing hours. The concerns against Option 1 — connection state as a second source of truth, ghost connections, a second datastore — are architectural and do not diminish with scale.

## A.5 Feeds `docs/cost-baseline.md`

| Cost cliff                   | Y3 headroom                          | Consequence                  |
| ---------------------------- | ------------------------------------ | ---------------------------- |
| Lambda free tier (1M req/mo) | ~74% unused at ~260K req/mo          | $0.20/M overage — negligible |
| Polling volume               | $0.16 against a $5 concern threshold | —                            |
| RDS connections              | 2 of ~112                            | RDS Proxy ~$11/mo            |

---

## Sources

[1]: https://enrollment.northwestern.edu/data/total-undergraduate-enrollment-overview.html
[2]: https://www.northwestern.edu/abroad/about/data.html

1. Northwestern University Enrollment — Total Undergraduate Enrollment Overview. https://enrollment.northwestern.edu/data/total-undergraduate-enrollment-overview.html _(accessed 2026-08-25; page last updated 2026-05-19)_
2. Northwestern Global Learning Office — Data. https://www.northwestern.edu/abroad/about/data.html _(accessed 2026-08-25)_
