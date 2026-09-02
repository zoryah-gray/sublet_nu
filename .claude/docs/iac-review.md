# IaC Review Checklist

Run against every `cdk diff` before deploy. This mirrors the job-market
expectation of reviewing IaC PRs "with a security and cost lens."

## Cost lens

- [ ] Any new always-on resource? Cost stated in the PR description?
- [ ] Any NAT Gateway in the synthesized template? (grep it — don't trust the construct)
- [ ] Log retention set on every new log group?
- [ ] Everything tagged?

## Security lens

- [ ] Any IAM statement with `"Resource": "*"`? Justified in a comment, or narrowed?
- [ ] Any IAM action with a wildcard? `s3:*` includes `s3:DeleteBucket`.
- [ ] Any security group with `0.0.0.0/0` inbound? RDS must be SG-to-SG only.
- [ ] S3 buckets: public access blocked, default encryption on, versioning considered.
- [ ] RDS: encryption at rest on, publicly accessible off, backups on.
      (Encryption cannot be added to an existing unencrypted instance in place.)

## Blast-radius lens

- [ ] Does this diff **replace** any stateful resource? `cdk diff` marks these —
      a replaced RDS instance or S3 bucket means data loss.
- [ ] Is there a rollback path that doesn't involve restoring from backup?
