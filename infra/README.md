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
  development source now defines a hosted Cognito login domain. Production
  still has no login domain; neither environment provisions initial users.
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
  idempotency keys have a 24-hour deduplication window. Expired receipts can be
  replaced atomically even before asynchronous TTL deletion; cancellation
  recovery recognizes only unexpired receipts.
  Both stream and scheduled deliveries validate the strict reporting schema.
  The publisher IAM grant permits only `rct.consulting` /
  `consulting.lead.created.v1` events on the discovered bus.
- No VPC, NAT, RDS, portfolio-owned EventBridge bus or legacy resource ownership
  changes.

Lead submission has bounded input, exact consent-version validation, a spam
honeypot, API throttling, client idempotency and atomic business/outbox writes.
PII is stored only in the domain table with the explicitly configured TTL; the
reporting event contains no lead details. The public form also stays hidden
unless its build-time API URL, approved consent copy/version and enable flag are
present. The default stack and preview remain closed.

The API's `PutItem` permission applies only within `TransactWriteItems` and only
to `LEAD#`, `IDEMPOTENCY#` and `OUTBOX#` partition-key prefixes. Standalone puts
are not granted.

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

This is not yet a launch-ready intake operation: the development login domain
is source-only and no lead notification, CAPTCHA/WAF control, owner assignment or live event-delivery
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
policy; the configured custom certificate uses TLS 1.2. The development preview
publisher below supports only generated CloudFront/API URLs, with no DNS changes.
Custom-domain publishing needs a separately reviewed extension of that validator.
Verify delegation, certificates and the complete change set before domain writes.

## Manual development web releases

`Publish development web preview` is a manual, main-only workflow targeting the
existing GitHub `development` environment. It does not create stacks, update
Lambda/API code, migrate data, modify DNS or publish production.

Before its first run, an authorized operator must review and create
`rct-consulting-development-foundation` in the real account, using approved
bootstrap/CloudFormation execution permissions. The existing GitHub OIDC
provider must include `sts.amazonaws.com`; the stack imports it, never recreates
it. Keep `LeadIntakeEnabled=false`. Consulting also needs the portfolio bus/SSM
discovery prerequisite, reviewed runtime permissions and budget/rollback gates.
Do not use the synthetic CI synth assembly or widen the shared bootstrap role.
Infrastructure deployment automation remains outstanding.

Development source defines an OIDC web publisher whose identity policy and
permissions boundary are the same narrowly scoped managed policy: bucket
listing/location and public-access-block/policy-status reads, GetObject/PutObject
for `assets/*` and `index.html`, invalidation
and status reads for its own CloudFront distribution, and DescribeStacks for
its own stack. It cannot delete objects, deploy infrastructure, edit identities,
mutate business data or use production resources. Trust is exact repository,
`development` environment and STS audience. Keep the environment's single
deployment branch policy `main`; environment OIDC subjects do not encode branches.

Set exactly these **environment variables**, not secrets, in
Settings > Environments > development:

| Variable | Value |
| --- | --- |
| `AWS_ACCOUNT_ID` | Verified real 12-digit account; not the CI synthetic account. |
| `AWS_WEB_PUBLISH_ROLE_ARN` | The deployed stack's `WebPublishRoleArn` output. |

Region is fixed to `us-east-1`. Bucket, distribution, API URL and browser Cognito
settings are validated and obtained from deployed stack outputs. Do not store
AWS access keys or a Cognito client secret. Public browser client IDs are not secrets.

After merge and bootstrap, manually run the workflow on `main`. It runs modern
checks and the high-severity audit, validates stack/account/role/closed intake,
requires all four S3 public-access blocks and an explicitly non-public bucket
policy, verifies the OAC origin and anonymous API denial, builds the gated web
app, uploads hashed assets before `index.html`, waits for invalidation, then
compares the live entry point and every emitted asset byte-for-byte with the build. It prints the actual
preview URL only after success. The build explicitly keeps public intake closed.
The publisher is independently implemented in each repository to preserve
separate ownership and release boundaries; no cross-repo runtime dependency is added.

Initial admin users and `ConsultingAdministrators` membership must be configured
by an authorized operator and tested through MFA/PKCE. The publisher cannot
manage users. Live sign-in, lead persistence/expiry/conflict handling and
EventBridge delivery still need a deployed-environment rehearsal.

For source rollback, revert a specific change through a checked PR; do not reset
branches. For a deployed stack, inspect a CDK diff/change set and redeploy the
last approved revision using the proper environment role. Never delete stacks,
tables, pools or DNS records as a rollback shortcut. Retention is not a tested
restore: rehearse PITR/auth recovery and artifact rollback before production.
For a web-only rollback, merge the reviewed revert and rerun the publisher. Old
hashed assets are intentionally retained and never deleted by publishing.
This workflow is not an artifact-history rollback system or tested recovery.

Strict TS remains enabled. Only infrastructure disables `exactOptionalPropertyTypes`
because current CDK declarations implement optional interface fields as explicit
`undefined`; app/API/domain checks retain it. Dependency auditing reports
moderate upstream minimatch advisories; high/critical findings block CI. This
does not certify the preserved legacy CRA dependency graph.
