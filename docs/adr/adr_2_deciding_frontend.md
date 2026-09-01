# Architectural Decision Record (ADR)

Title: Deciding Frontend Framework
Date: 04/05/26

## Summary:

Issue and Context:

> Before beginning the new software project, need to decide which frontend framework to use: React or Next.js.

Decision:

> Next.js

Status
proposed | rejected | **accepted** | deprecated

## Details

### Context and Problem Statement

> Before beginning the new software project, need to decide which frontend framework to use. Going between React and Next.js.

### Considered Options

1. React
   1. Pros
      > Familiarity
      > Responsive and accessible framework integrations
      > TypeScript compatible
   2. Cons
      > Bulky frontend
      > Unsure of AWS integration speeds
      > Would need a separate backend (Node) with separate ports and configs
2. Next.js
   1. Pros
      > React framework
      > Combines routing and server-side rendering
      > Trusted Vercel deployment
   2. Cons
      > Unfamiliar
      > Not good for ACID transactions or WebSocket connections

### Decision outcome

**Chosen option**: Next.js, because it condenses the routing, separate API routes, and speeds up server-side rendering.

### Consequences

**Harder to do:** Connecting WebSockets and ACID transactions — but this shouldn't be a problem since an e-commerce/payment layer is not a must-have for v1.
