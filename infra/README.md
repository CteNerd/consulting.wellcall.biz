# Consulting infrastructure foundation

This is reviewed source, not a deployment authorization or completed application.
Run from the repository root with Node 24 and npm 11.6.2:

```sh
npm ci --workspaces --include-workspace-root=false --no-audit --no-fund
npm run lint --workspace @rct/consulting-infra
npm run check:foundation
npm run cdk:synth:development
npm run cdk:synth:production
```

The synth scripts use the deliberately synthetic account `123456789012`, no
AWS lookups, and separate ignored `infra/cdk.out/` directories. Never deploy that
assembly. Actual deployment must explicitly select the verified account and
environment after IAM/bootstrap/change-set review; it is not automated here.
Missing or invalid target context fails. `us-east-1` is explicit.

## What the templates define

- Independent `rct-consulting-development` / `rct-consulting-production` resources.
- On-demand core table; production PITR, deletion protection and retention.
- Private S3 with CloudFront OAC, HTTPS redirection and security headers.
  Assets are not uploaded by synth. No broad SPA error fallback is configured.
- Invitation-only Cognito with required authenticator MFA and a public client.
  No signup/login UI, hosted login domain or initial users are provisioned.
- Node 24 Lambda, explicit scoped log-write role, 7/30-day dev/prod logs.
- HTTP API: public `GET /health`, JWT-protected `GET /me`, exact web-origin CORS.
  The handler has no database, EventBridge, finance or business-write access.
- No VPC, NAT, RDS, EventBridge or legacy resource ownership changes.

Only the health/identity foundation is runnable. Project/time/finance policies
are tested separately, not implemented CRUD endpoints. Future APIs must derive
the caller from verified claims, load trusted memberships and assignments, and
apply those policies before data access. Never authorize from request-body roles.

## DNS and release gates

By default no Route 53 or ACM resources are created; generated service URLs are
outputs. Opt-in `customDomains=true` imports the existing zone by ID, creates
the web ACM certificate in `us-east-1`, and manages only explicit web aliases.
Development API stays on its generated URL. Production additionally configures
`api.thirddowntech.com` and requires `brandLaunchApproved=true`; that flag does
not substitute for legal review or protected environment approval.

The generated CloudFront hostname uses CloudFront's default certificate/security
policy; the configured custom certificate uses TLS 1.2. Review and enable the
approved development custom domain before a shared preview release. Verify zone
delegation, certificate issuance and the complete change set before writes.

Deployment CI is intentionally absent until repo/environment OIDC trust,
CloudFormation execution/pass-role boundaries, protected production approval,
budget notification receipt and smoke/rollback tooling are reviewed. Never put
AWS keys in GitHub secrets. Required future environment inputs: `AWS_ACCOUNT_ID`,
`AWS_REGION`, `AWS_DEPLOY_ROLE_ARN`, plus validated output-based smoke URLs.

For source rollback, revert a specific change through a checked PR; do not reset
branches. For a deployed stack, inspect a CDK diff/change set and redeploy the
last approved revision using the proper environment role. Never delete stacks,
tables, pools or DNS records as a rollback shortcut. Retention is not a tested
restore: rehearse PITR/auth recovery and artifact rollback before production.

Strict TS remains enabled. Only infrastructure disables `exactOptionalPropertyTypes`
because current CDK declarations implement optional interface fields as explicit
`undefined`; app/API/domain checks retain it. Dependency auditing reports
moderate upstream minimatch advisories; high/critical findings block CI. This
does not certify the preserved legacy CRA dependency graph.
