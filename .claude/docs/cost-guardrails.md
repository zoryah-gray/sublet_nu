# Cost Guardrails

**Hard ceiling: $30/month.** Above this, something gets removed rather than absorbed.
Current baseline and per-resource decisions: `docs/cost-baseline.md`

## Stop and ask before creating

| Resource                   | Approx. monthly                 | Cheaper alternative to propose first                                           |
| -------------------------- | ------------------------------- | ------------------------------------------------------------------------------ |
| NAT Gateway                | ~$33 each                       | VPC gateway endpoint (S3/DynamoDB, free) or interface endpoint (~$7.30 per AZ) |
| Application Load Balancer  | ~$16–22                         | API Gateway HTTP API (~$1/million requests)                                    |
| RDS Multi-AZ               | 2× instance cost                | Single-AZ + automated backups, documented RTO                                  |
| Aurora Serverless v2       | ~$43 at 0.5 ACU floor           | RDS db.t4g.micro (~$11.50)                                                     |
| Interface VPC endpoint     | ~$7.30 per AZ                   | Check whether the caller can live outside the VPC; deploy to one AZ, not all   |
| ECS Fargate task           | Billed per task-hour, always on | Lambda                                                                         |
| CloudWatch Config recorder | Per configuration item          | Skip in a single-account setup                                                 |

## Always

- API Gateway: **HTTP API**, not REST API, unless a REST-only feature is required.
- Every CDK log group: `retention: logs.RetentionDays.ONE_WEEK`.
- Every CDK resource tagged `Project=SubletNU` so Cost Explorer can group it.
- S3 lifecycle rules considered for anything that accumulates.

## Watch for in CDK L2 constructs

`ec2.Vpc` defaults to one NAT Gateway **per AZ**. Set `natGateways: 0` explicitly
and use `subnetType: PRIVATE_ISOLATED`. Read the synthesized template, not just the
construct call.
