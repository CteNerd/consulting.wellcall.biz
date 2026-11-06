# Consulting infrastructure foundation

This is reviewable source, not a deployment authorization or completed application.
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
- On-demand core table; production PITR and deletion protection. Lead records use
  DynamoDB TTL only after an explicit retention value is provided.
- Private S3 with CloudFront OAC, HTTPS redirection and security headers.
  Assets are not uploaded by synth. No broad SPA error fallback is configured.
- Invitation-only Cognito with required authenticator MFA and a public client.
  The web source includes a configuration-gated PKCE admin sign-in and inbox;
  no hosted login domain or initial users are provisioned.
- Node 24 API and outbox-publisher Lambdas with separate scoped roles and
  7/30-day dev/prod logs.
- HTTP API: public `GET /health` and `POST /leads`, JWT-protected `GET /me`,
  `GET /admin/leads` and `PATCH /admin/leads/{leadId}`, exact web-origin CORS and
  bounded stage throttling. The lead inbox also requires the
  `ConsultingAdministrators` Cognito group in the
  verified token; its reader can query only the PII-projected `LeadListingIndex`
  and returns at most 25 records per page. The group has no members by default.
  Lead intake defaults off;
  enabling it requires explicit intake, consent-policy-version and retention
  parameters. The API role can read idempotency records and transact lead,
  idempotency and sanitized outbox writes in the Consulting table.
- DynamoDB Streams publish only strict, aggregate-only reporting details to the
  portfolio EventBridge bus discovered from SSM. Failed stream batches go to a
  14-day SQS failure queue; a five-minute reconciliation schedule retries
  pending outbox records. The event reporting month is based on UTC and API
  idempotency keys are retained for 24 hours.
- No VPC, NAT, RDS, portfolio-owned EventBridge bus or legacy resource ownership
  changes.

Lead submission has bounded input, exact consent-version validation, a spam
honeypot, API throttling, client idempotency and atomic business/outbox writes.
PII is stored only in the domain table with the explicitly configured TTL; the
reporting event contains no lead details. The public form also stays hidden
unless its build-time API URL, approved consent copy/version and enable flag are
present. The default stack and preview remain closed.

The inbox UI stays unavailable unless all four HTTPS build settings are present:
`VITE_ADMIN_AUTH_URL` (Cognito hosted UI origin), `VITE_ADMIN_API_URL`,
`VITE_ADMIN_CLIENT_ID` and `VITE_ADMIN_USER_POOL_ID`. It uses authorization-code
PKCE, keeps access tokens in memory, and sends them only to the API. The client
is a public OAuth client; never add a client secret to the web build.

Admins can mark inquiries New, Contacted, Qualified or Closed, including
reopening a closed inquiry. These are follow-up labels, not authorization,
project creation, contact automation or finance actions. `PATCH` accepts only
`status` and `expectedVersion`; DynamoDB checks the displayed version and
unexpired lead record atomically. Conflicts return 409 and require an explicit
refresh, not an automatic overwrite or retry. The latest actor and update time
are recorded on the lead without changing its TTL; no PII-bearing event is
published. The API's UpdateItem grant is restricted to `LEAD#` partition keys.
Older leads without follow-up fields read as New/version 0.

The listing index is eventually consistent, so a refresh can briefly show a
previous status. Successful saves update the displayed card from the confirmed
write result. Expired leads are excluded from listing even while DynamoDB TTL
deletion is pending and cannot be updated. An expiry-filtered page may be empty
while still containing a next-page token; continue pagination to review older
unexpired records. This is read/update expiry enforcement, not verified
physical deletion or a complete retention process.

This is not yet a launch-ready intake operation: no hosted Cognito login domain,
lead notification, CAPTCHA/WAF control, owner assignment or live event-delivery
verification exists. Do not enable intake until those operational gaps and the
consent/retention policy are approved. Project/time/finance policies remain
tested separately, not implemented CRUD endpoints. Future APIs must derive the
caller from verified claims, load trusted memberships and assignments, and
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
