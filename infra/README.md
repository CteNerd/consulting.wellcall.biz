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
  a source-only viewer-request CloudFront Function rewrites GET/HEAD requests
  for the 14 approved public pages (including `/work` and a trailing slash) to
  the matching static metadata shell (`index.html` for `/`, `route-meta/*.html`
  otherwise). Query parameters are preserved. Unknown URLs and missing assets retain their
  origin errors; API/internal paths are not added as public pages. New public
  routes must update this exact allowlist alongside the frontend. The currently
  deployed distribution has no such rewrite: a web-only publish cannot enable
  hosted deep-link refresh. Review the infrastructure change and preserve the
  existing development alias/certificate before deploying it; no live update
  is authorized by this source change.
- Invitation-only Cognito with required authenticator MFA and a public client.
  The web source includes a configuration-gated PKCE admin sign-in and inbox;
  both environments define a hosted Cognito login domain. Neither environment
  provisions initial users or memberships. A public brand does not open access.
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
to `LEAD#`, `IDEMPOTENCY#`, `OUTBOX#` and workspace `PROJECT#` partition-key
prefixes. Standalone puts and membership-record writes are not granted.

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
published. The lead-update grant is restricted to `LEAD#` partition keys;
separate workspace updates require a transaction and `PROJECT#` keys.
Older leads without follow-up fields read as New/version 0.

The listing index is eventually consistent, so a refresh can briefly show a
previous status. Successful saves update the displayed card from the confirmed
write result. Expired leads are excluded from listing even while DynamoDB TTL
deletion is pending and cannot be updated. An expiry-filtered page may be empty
while still containing a next-page token; continue pagination to review older
unexpired records. This is read/update expiry enforcement, not verified
physical deletion or a complete retention process.

This is not yet a launch-ready intake operation: the development login domain
is source-only and no lead notification, CAPTCHA/WAF control, owner assignment
or live event-delivery verification exists. Do not enable intake until those
operational gaps and the consent/retention policy are approved.

## Project workspace and time (source-only)

The authenticated API source now includes:

- `GET /projects`, `GET|POST /projects/{projectId}/assignments`, and
  `GET|POST /projects/{projectId}/tasks` plus
  `PATCH /projects/{projectId}/tasks/{taskId}`.
- `POST /projects/{projectId}/time-entries`,
`PATCH /projects/{projectId}/time-entries/{timeEntryId}`,
  `POST /projects/{projectId}/time-entries/{timeEntryId}/submit`,
  `GET /my/time-entries`, `GET /projects/{projectId}/pending-time`, and
  `POST /projects/{projectId}/time-entries/{timeEntryId}/review`.

Every project request uses the verified JWT subject, then loads a separate
active Consulting membership and a matching active project assignment from the
core table. Cognito group claims and request-body roles do not authorize this
slice. An administrator is identified by the trusted membership record and
still needs an active project assignment. Contributors see only tasks assigned
to them and may create/submit their own time against those tasks. Assigned
managers (or an app administrator with a project assignment) can manage tasks
and review submitted entries; the submitter cannot approve their own entry.
Task and time transitions use expected versions and conditional transactional
writes. Those transactions also persist actor/action audit rows without
emitting reporting events. No rates, contracts, invoices, finance routes, or
cross-repository data access are part of the API.

The strict JSON mutation bodies are `{userId, role}` for assignment creation
(`role` is `contributor|manager`, with manager assignment restricted to app
administrators), `{title, description, assignedToUserId}` for task creation,
and `{status, expectedVersion}` for task status updates (`TODO`,
`IN_PROGRESS`, `BLOCKED`, `DONE`; `DONE` is terminal). Time draft creation
accepts `{taskId, workDate, minutes, description}`; the project ID comes only
from the path and the worker only from the JWT. `PATCH` time-entry correction
accepts exactly `{taskId, workDate, minutes, description, expectedVersion}`.
Only the owner may edit a `DRAFT` or correct a `REJECTED` entry; correction
returns it to `DRAFT`, clears its current submission/review fields and pending
index keys, and appends a versioned audit record without deleting prior audit
history. The transaction independently rechecks active app membership, active
project assignment, task assignment, owner, editable status and expected
version. `SUBMITTED` and `APPROVED` records are not editable. Submit accepts only
`{expectedVersion}`. Review accepts `{decision, expectedVersion, note?}`,
where decision is `APPROVED|REJECTED`. Bodies reject unknown fields and have
bounded sizes; list pages are capped at 25 projects, 50 tasks/time entries, or
25 pending reviews.

The core table uses `PROJECT#<uuid>` partitions for project metadata,
assignments, tasks, time entries and audit rows; `USER#<subject>` partitions
contain membership records. `WorkspaceIndex` supports bounded user-scoped
assignment/task/time lists, while the existing pending index supports a
bounded project review queue. Workspace writes use only `PROJECT#` keys;
membership and project records are not created by this API. Before any
deployment, an authorized operator would need to provision reviewed project
and membership records and an initial manager/admin project assignment. No
such data or user is seeded here. `WorkspaceIndex` is a proposed change to the
existing core table: review its backfill, capacity, and change set before any
deployment. No time-entry retention/expiry policy is implemented or approved.

The source-only web entry `/?workspace` integrates these routes with the existing configuration-gated
Cognito helper. It lists assigned projects/tasks, supports own time
creation/editing/submission and rejected-time correction, and exposes manager
assignment/task/review controls. It surfaces denial/conflict responses and
clears state on expired sessions. It does not seed memberships/projects or
bypass backend authorization.

This is a tested, source-only slice, not a deployed workflow or
production-readiness claim. There is no assignment-revocation UI, membership
administration API, live Cognito/DynamoDB rehearsal, or finance implementation.
Intake remains disabled. Never authorize from request-body roles. Approved-time
correction/reversal and document storage are not implemented; do not simulate
them in the client or describe the full C2 plan as complete.

An explicitly opt-in synthetic rehearsal runs the actual workspace UI against
an in-memory adapter, only when Vite development mode, the `dev:uat` startup
flag, `uatRehearsal=1`, and a loopback host all agree. It is not real auth,
DynamoDB or the live API, and sends no token, request or event to AWS. From the
repository root:

```sh
npm run dev:uat --workspace @rct/consulting-web
```

Open `http://127.0.0.1:5186/?workspace&uatRehearsal=1`. The normal dev server
and unconfigured preview keep the real sign-in gate. `npm run
build:web` rejects production bundles that contain the UAT adapter's fixture
identities and records. This is not a substitute for testing deployed
authorization, persistence, Cognito or AWS integrations.

The separate API integration test exercises the real
`DynamoWorkspaceStore` against a disposable DynamoDB Local table. It validates
`DYNAMODB_ENDPOINT` as plain HTTP loopback, uses explicit local-only credentials,
creates an isolated table with the current three indexes, and deletes it in a
`finally` block. Requests carry synthetic subjects, not Cognito-issued JWTs.
The workflow writes only workspace records and audit rows; it does not send
reporting events or connect to real AWS. Start DynamoDB Local separately, then
run from the repository root:

```sh
DYNAMODB_ENDPOINT=http://127.0.0.1:8000 node --test apps/api/src/workspace.integration.ts
```

This validates local transaction persistence, not the deployed table migration,
IAM policy, Cognito integration, or production readiness. It is not part of the
ordinary API unit-test command and requires DynamoDB Local to be started
explicitly.

## DNS and release gates

By default no Route 53 or ACM resources are created. In account `425061472162`,
development **imports** the existing certificate
`arn:aws:acm:us-east-1:425061472162:certificate/f188b0ef-39b4-4020-8c95-1b11a586942f`
and preserves `dev.thirddowntech.com`, even with `customDomains=false`.
`existingDevCertificateArn` can explicitly supply an existing same-account
us-east-1 certificate for a development target. This mode never recreates or
adopts the pre-existing DNS records or certificate; do not bootstrap dev again.
Other default synths retain generated URLs. Opt-in `customDomains=true` imports the existing zone by ID, creates
the web ACM certificate in `us-east-1`, and manages only explicit web aliases.
Development API stays on its generated URL. Production additionally configures
`api.thirddowntech.com` and requires `brandLaunchApproved=true`; that flag does
not substitute for legal review or protected environment approval.

The generated CloudFront hostname uses CloudFront's default certificate/security
policy; the configured custom certificate uses TLS 1.2. The source publisher
validator accepts the generated CloudFront URL or exactly
`https://dev.thirddowntech.com`; for the custom URL it verifies the distribution
alias and ACM/TLS configuration. The development UPDATE must use the imported certificate path above, not create
another certificate or DNS records. Review the complete change set.
Publishing itself never changes DNS. See the [development handoff](../docs/development-handoff-2026-11-06.md).

## Manual development web releases

`Publish development web preview` is a manual, main-only workflow targeting the
existing GitHub `development` environment. It does not create stacks, update
Lambda/API code, migrate data, modify DNS or publish production.

Before its first run, an authorized operator must review and create
`rct-consulting-development-foundation` in the real account, using approved
owner-authorized CloudFormation change-set permissions. The existing GitHub OIDC
provider must include `sts.amazonaws.com`; the stack imports it, never recreates
it. Keep `LeadIntakeEnabled=false`. Consulting also needs the portfolio bus/SSM
discovery prerequisite, reviewed runtime permissions and budget/rollback gates.
Do not use the synthetic CI synth assembly or shared CDKToolkit executor.
Infrastructure deployment automation remains outstanding.

Development source defines an OIDC web publisher whose identity policy and
permissions boundary are the same narrowly scoped managed policy: bucket
listing/location and public-access-block/policy-status reads, GetObject/PutObject
for `assets/*`, `index.html` and `route-meta/*`, invalidation
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
app, uploads hashed assets and all HTML shells, waits for invalidation, then
compares route HTML and every emitted asset byte-for-byte with the build. It prints the actual
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

## Protected production web promotion

Public brand publication is approved; intake, enrollment, initial users and
Founderowner access remain closed pending real UAT. This PR supplies source
only. It does not deploy infrastructure, configure GitHub environments or
change AWS/DNS. The parent operator owns reviewed bootstrap/change sets.

`Promote reviewed production web candidate` is manual and main-only. Supply the
full reviewed `main` SHA as `reviewed_sha`; it must match the dispatch SHA.
The candidate job installs only modern workspaces on Node 24/npm 11.6.2,
runs checks once, builds once with explicit production presentation, and
leaves all intake/consent/API/auth settings disabled or empty.
The immutable artifact contains `index.html`, one generated `route-meta/*.html`
shell per public route, hashed JS/CSS assets and a SHA-256 inventory manifest
bound to repository, reviewed SHA and run ID. Each shell shares the SPA bundles
but supplies route-specific title, description, canonical URL, Open Graph and
Twitter metadata to crawlers that do not execute JavaScript.
Its exact artifact ID and manifest digest pass to both protected jobs.
Both verify every byte, inventory and provenance before OIDC; neither rebuilds.

The `development` job uses only the dev publisher and verifies account, stack,
private bucket/OAC, alias/certificate, API health, anonymous 401s, disabled intake,
HTML/deep links, every emitted asset and missing-path errors. It requires the
dev `X-Robots-Tag: noindex, nofollow` header **before** writing public-candidate
bytes. Infrastructure must install that header first. The web publisher stages
and verifies all route shells before the exact-route function is switched from
the SPA entry point to those shells; its summary reports whether the mapping is
active. `production` depends on the successful stage and uses only its own
protected-environment publisher with the same scoped policy/boundary.
The production origin must be exactly `https://thirddowntech.com`.
No broad SPA fallback, delete sync, identity/data writes or cross-env role
assumption is permitted.

### Operator prerequisites and commands (not executed here)

Keep the existing GitHub OIDC provider and dev bootstrap; do not duplicate them.
Both GitHub environments require a `main` deployment-branch restriction;
`production` must require independent reviewer approval with no self-approval
or administrator bypass. Configure `AWS_WEB_PUBLISH_ROLE_ARN` in **each**
environment from that stack's `WebPublishRoleArn`. The new promotion workflow
fixes account `425061472162`; the existing development publisher additionally
uses its backwards-compatible `AWS_ACCOUNT_ID` environment variable.
No static AWS credentials, secrets or client secrets are required.

From the repository root, offline synthesis (no lookup or deployment):

```sh
npm exec --workspace @rct/consulting-infra -- cdk synth \
  -c environment=development -c account=425061472162 \
  -c existingDevCertificateArn=arn:aws:acm:us-east-1:425061472162:certificate/f188b0ef-39b4-4020-8c95-1b11a586942f \
  --output cdk.out/review-development --quiet
npm exec --workspace @rct/consulting-infra -- cdk synth \
  -c environment=production -c account=425061472162 \
  -c customDomains=true -c brandLaunchApproved=true \
  --output cdk.out/review-production --quiet
```

### Isolated asset bootstrap and current-credential publication

The application always uses `CliCredentialsStackSynthesizer`, never the shared
default deploy/CloudFormation executor. Its assembly has **no** assume-role,
execution-role, lookup-role or bootstrap-version SSM bindings. File assets,
including the generated template, use only `release/` in:

| Environment | Release asset bucket |
| --- | --- |
| development | `rct-consulting-development-assets-425061472162-us-east-1` (existing; preserve exactly) |
| production | `rct-consulting-production-release-assets-425061472162-us-east-1` |

`infra/release-assets.production.template.json` is the complete minimal
production asset-only bootstrap template. It creates just the named private
SSE-S3/AES256, bucket-owner-enforced, versioned retained bucket and a retained
TLS-only deny policy. Outputs: `ReleaseAssetsBucket`, `FileAssetPrefix=release/`.
No IAM role, executor, trust chain, SSM binding, access grant, development
resource or web bucket is created. Do not run `cdk bootstrap`, recreate the
existing development asset bucket, or use the verified broad shared executor.

The parent must inspect and authorize the **initial** IAM-bearing foundation
change set with approved owner credentials. This template supplies no new
executor and no role-chain bypass. Current credentials need reviewed
bucket-location/list and `release/*` GetObject/PutObject access for asset
publication, plus separately authorized CloudFormation/application permissions
for change-set preparation/execution. The web OIDC publisher is deliberately
insufficient: it cannot publish Lambda assets or deploy infrastructure.
Do not select a profile that silently assumes the shared deploy/execution roles.

These are **operator-only AWS writes, not run by this agent**. From the
repository root, first prepare the asset-only production bootstrap CREATE:

```sh
set -euo pipefail
export AWS_REGION=us-east-1 AWS_DEFAULT_REGION=us-east-1 AWS_PAGER=""
test "$(aws sts get-caller-identity --query Account --output text)" = 425061472162 \
  || { printf '%s\n' 'STOP: wrong or unverified AWS account.' >&2; exit 1; }
aws cloudformation create-change-set \
  --region us-east-1 --stack-name rct-consulting-production-release-assets \
  --change-set-name consulting-production-release-assets-create \
  --change-set-type CREATE \
  --template-body file://infra/release-assets.production.template.json
aws cloudformation wait change-set-create-complete \
  --region us-east-1 --stack-name rct-consulting-production-release-assets \
  --change-set-name consulting-production-release-assets-create
aws cloudformation describe-change-set \
  --region us-east-1 --stack-name rct-consulting-production-release-assets \
  --change-set-name consulting-production-release-assets-create
```

Only after explicit inspection/authorization, the parent may separately run:

```sh
set -euo pipefail
aws cloudformation execute-change-set \
  --region us-east-1 --stack-name rct-consulting-production-release-assets \
  --change-set-name consulting-production-release-assets-create
aws cloudformation wait stack-create-complete \
  --region us-east-1 --stack-name rct-consulting-production-release-assets
```

There is no `--role-arn`: this new asset-only stack
must not inherit a service role. No IAM capability is needed for its two S3
resources. If a stack with that name already exists, stop and inspect it rather
than treating CREATE failure as permission to replace/adopt anything.

After both release asset buckets exist and the portfolio event-bus SSM
prerequisites are satisfied, publish from the reviewed offline assemblies
using **only the currently approved credentials**, with no role switch:

```sh
set -euo pipefail
npm exec --workspace @rct/consulting-infra -- cdk publish-assets --unstable=publish-assets \
  --app cdk.out/review-development rct-consulting-development-foundation
npm exec --workspace @rct/consulting-infra -- cdk publish-assets --unstable=publish-assets \
  --app cdk.out/review-production rct-consulting-production-foundation
```

The pinned CDK CLI requires the explicit `--unstable=publish-assets` opt-in.
This uploads the generated CloudFormation template as well as both Lambda
ZIPs; it does not deploy. The generated foundation template exceeds the
CloudFormation inline-body limit, so use its published HTTPS S3 URL.
Derive URLs from the actual assemblies rather than copying a stale hash:

```sh
set -euo pipefail
test "$(aws sts get-caller-identity --query Account --output text)" = 425061472162 \
  || { printf '%s\n' 'STOP: wrong or unverified AWS account.' >&2; exit 1; }
template_url() {
  node --input-type=module - "$1" "$2" <<'NODE'
import { readFileSync } from "node:fs";
const [directory, stack] = process.argv.slice(2);
const manifest = JSON.parse(readFileSync(`${directory}/manifest.json`, "utf8"));
const uri = new URL(manifest.artifacts[stack].properties.stackTemplateAssetObjectUrl);
console.log(`https://${uri.hostname}.s3.us-east-1.amazonaws.com${uri.pathname}`);
NODE
}
DEV_TEMPLATE_URL=$(template_url infra/cdk.out/review-development rct-consulting-development-foundation)
PROD_TEMPLATE_URL=$(template_url infra/cdk.out/review-production rct-consulting-production-foundation)

# CloudFormation retains a stack's existing RoleARN when --role-arn is omitted.
# Fail closed rather than silently reusing any existing service role on dev UPDATE.
test "$(aws cloudformation describe-stacks --region us-east-1 \
  --stack-name rct-consulting-development-foundation \
  --query 'Stacks[0].RoleARN' --output text)" = None \
  || { printf '%s\n' 'STOP: existing or unverified CloudFormation service role.' >&2; exit 1; }

aws cloudformation create-change-set \
  --region us-east-1 --stack-name rct-consulting-development-foundation \
  --change-set-name consulting-development-public-source \
  --change-set-type UPDATE --template-url "$DEV_TEMPLATE_URL" \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameters ParameterKey=LeadIntakeEnabled,ParameterValue=false \
    ParameterKey=LeadConsentPolicyVersion,UsePreviousValue=true \
    ParameterKey=LeadRetentionDays,UsePreviousValue=true
aws cloudformation create-change-set \
  --region us-east-1 --stack-name rct-consulting-production-foundation \
  --change-set-name consulting-production-public-source \
  --change-set-type CREATE --template-url "$PROD_TEMPLATE_URL" \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameters ParameterKey=LeadIntakeEnabled,ParameterValue=false
```

If development reports any `RoleARN`, **stop**: omission does not clear a sticky
service role. Report it for separate owner review; do not pass a shared role,
add an ad hoc executor or work around its trust. Production foundation CREATE
likewise requires the stack to be absent; inspect any existing stack rather
than silently changing CREATE to UPDATE. Do not add `--role-arn` to these
instructions. The parent's separately approved initial IAM bootstrap, not
shared AdministratorAccess, owns the necessary authorization.

For each application change set, the parent must separately
wait and inspect (including IAM changes):

```sh
for target in development production; do
  aws cloudformation wait change-set-create-complete \
    --region us-east-1 --stack-name "rct-consulting-$target-foundation" \
    --change-set-name "consulting-$target-public-source"
  aws cloudformation describe-change-set \
    --region us-east-1 --stack-name "rct-consulting-$target-foundation" \
    --change-set-name "consulting-$target-public-source"
done
```

Only after separate owner authorization for each target, execute its reviewed
change set and wait for its matching operation (not run by this agent):

```sh
set -euo pipefail
aws cloudformation execute-change-set \
  --region us-east-1 --stack-name rct-consulting-development-foundation \
  --change-set-name consulting-development-public-source
aws cloudformation wait stack-update-complete \
  --region us-east-1 --stack-name rct-consulting-development-foundation
aws cloudformation execute-change-set \
  --region us-east-1 --stack-name rct-consulting-production-foundation \
  --change-set-name consulting-production-public-source
aws cloudformation wait stack-create-complete \
  --region us-east-1 --stack-name rct-consulting-production-foundation
```

No execution is automated here.
Dev UPDATE must preserve the existing distribution, alias/certificate, pool,
bucket and table with no DNS adoption. Production creates apex/API DNS and
certificate only under the explicit synth flags above. Never deploy synthetic
account assemblies, seed users, repeat dev bootstrap or use stack deletion
as a migration shortcut. Intake and access remain closed.

### Provenance and rollback

Candidate and per-environment promotion artifacts are retained for 90 days
(subject to repository retention policy). Promotion records include reviewed
SHA, run/attempt, manifest digest, distribution and invalidation IDs. Each
record is persisted before S3 publication and updated immediately when an
invalidation ID is available; an exit trap preserves failed-check state and
exit status rather than losing the attempted release's provenance. Each
environment artifact also captures the previous `index.html` and route shells
when present, including on a later verification failure. Old hashed assets remain in S3.
Download/archive approved artifacts before expiry if longer recovery is needed.

For exact-byte rollback while the original candidate artifact remains retained,
an authorized operator may re-run **only the production job** of the selected
previous successful workflow run through its protected production approval.
It uses that run's original artifact ID, digest and successful development
stage, never rebuilds, and rechecks present-day backend/intake/destination gates.
Verify the old SHA, artifact/digest and prior staging evidence before approval;
this is an intentional rollback, not a bypass for a new unreviewed candidate.
Do not re-run the candidate job over an existing immutable artifact name.
Expired/missing artifacts fail closed: use a reviewed revert/new candidate
instead, or separately review restoration of the captured prior entry point
against retained assets. No stack deletion, broad identity, automatic rollback
or tested live recovery is implied. Real UAT and recovery rehearsal remain
required before opening collection or access.
