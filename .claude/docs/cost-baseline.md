# Cost Baseline

> **Status:** template — fill in on Day 1 from the AWS Pricing Calculator (https://calculator.aws/), then update the Actual column on Day 16 and monthly thereafter.
> This file exists so that "is this too expensive?" has an answer a reviewer can check, rather than a judgment call made fresh each time.

**Hard ceiling:** $**\_\_** / month. Above this, something gets removed — not absorbed.
**Comfortable target:** $**\_\_** / month.
**Region:** **\_\_**

---

## Estimated vs. actual

| Service         | Configuration   | Estimated | Actual (Day 16) | Actual (M+1) | Notes                                  |
| --------------- | --------------- | --------- | --------------- | ------------ | -------------------------------------- |
| RDS PostgreSQL  |                 |           |                 |              |                                        |
| Lambda          |                 |           |                 |              |                                        |
| API Gateway     | HTTP API        |           |                 |              |                                        |
| S3              |                 |           |                 |              |                                        |
| CloudFront      |                 |           |                 |              |                                        |
| SQS             |                 |           |                 |              |                                        |
| SES             |                 |           |                 |              |                                        |
| Cognito         |                 |           |                 |              | verify current MAU free tier           |
| VPC endpoints   |                 |           |                 |              | per-AZ pricing                         |
| Route 53        | hosted zone     |           |                 |              | + domain registration, billed annually |
| CloudWatch Logs | 7-day retention |           |                 |              |                                        |
| Vercel          |                 |           |                 |              |                                        |
| **Total**       |                 |           |                 |              |                                        |

**Estimate vs. actual gap:** **\_\_**%
**Where the estimate was most wrong, and why:** **\_\_**

> The gap analysis is the point of this table. Being off by 40% on one line is the lesson; a total that happens to match is luck. Whatever you were most wrong about is the service whose pricing model you don't yet understand.

---

## Per-resource decision log

Every resource above should be traceable to a decision. When Claude Code or a future you asks "why RDS and not Aurora," the answer lives here.

| Resource | Alternative considered | Cost delta | Why chosen | Revisit when |
| -------- | ---------------------- | ---------- | ---------- | ------------ |
|          |                        |            |            |              |

---

## Known cost cliffs

Things that are cheap now and stop being cheap at a specific, nameable threshold. Fill these in as you discover them — this is the "reasoning about cost and scaling implications of service choices" artifact.

| Trigger                                      | Current headroom | What happens                        | Est. cost after |
| -------------------------------------------- | ---------------- | ----------------------------------- | --------------- |
| Lambda free tier (1M req/mo) exhausted       |                  |                                     |                 |
| CloudFront free tier (1 TB/mo out) exhausted |                  |                                     |                 |
| SQS free tier (1M req/mo) exhausted          |                  |                                     |                 |
| RDS storage fills                            |                  |                                     |                 |
| RDS connection limit reached                 |                  | RDS Proxy or pool resizing required |                 |
| Polling volume at N active users             |                  |                                     |                 |

---

## Monthly review checklist

Run at the start of the first session each month.

- [ ] Cost Explorer, grouped by the `Project=SubletNU` tag — any service that moved more than 20%?
- [ ] Any resource in the bill that isn't in the table above? (That's an orphan or an untagged resource.)
- [ ] Any CloudWatch log group without a retention policy?
- [ ] Trusted Advisor cost-optimization checks — idle resources, unassociated Elastic IPs, unattached volumes.
- [ ] Update the Actual column. Do not skip this; the trend is worth more than any single month.
