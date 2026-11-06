# Portfolio development and release handoff

Date: 2026-11-06.
Scope: Consulting, Community, and the two existing personal/Founder worktrees.

## Executive status

**Both producer development previews are now deployed and verified.** Their
real publisher roles exist, both required GitHub development variables are
configured, and the manual OIDC publishing workflows passed. Founder governance,
release planning, API/projections and portfolio reporting/eventing are also
provisioned in development.

Consulting has gated lead intake, a protected admin inbox and versioned
follow-up statuses. Community has tested adult-approval domain rules, but still
needs an operational application/review flow. The Founder dashboard and
execution-permission refinements remain uncommitted in their original worktrees.

**Public intake, enrollment and Founder owner access remain closed.** No initial
Cognito users, production resources, custom domains or DNS changes were created.
Merging runs CI; publishing a changed producer preview still requires manually
dispatching `publish-development.yml` on `main`.

The current activation sections below supersede the explicitly historical
source-only snapshots later in this report. Feature development can resume
without repeating this initial infrastructure bootstrap.

## Verified development activation

Account: `425061472162`. Region: `us-east-1`.

| Application | Live preview | Successful publishing run |
| --- | --- | --- |
| Consulting | [Development site](https://d38dz368foep1n.cloudfront.net/) / [admin entry](https://d38dz368foep1n.cloudfront.net/?admin) | [42248813337](https://github.com/CteNerd/consulting.wellcall.biz/actions/runs/42248813337) |
| Community | [Development site](https://d3rh9e476mucty.cloudfront.net/) | [42247345620](https://github.com/CteNerd/community.wellcall.biz/actions/runs/42247345620) |

Both GitHub `development` environments retain the `main` deployment branch
policy. These exact values were set and read back:

- Both repositories: `AWS_ACCOUNT_ID=425061472162`.
- Consulting `AWS_WEB_PUBLISH_ROLE_ARN`:
  `arn:aws:iam::425061472162:role/rct/consulting/development/rct-consulting-development-web-publish`.
- Community `AWS_WEB_PUBLISH_ROLE_ARN`:
  `arn:aws:iam::425061472162:role/rct/dotcom/development/rct-dotcom-development-web-publish`.

The publisher ARNs came from the completed stacks' `WebPublishRoleArn` outputs
and were checked against the actual IAM roles, boundaries and exact
repository/environment OIDC trust. No AWS access-key secrets were added.
Do not substitute an IAM user, planner or CloudFormation execution role.

### AWS resources created

All eight stacks reached actual `CREATE_COMPLETE`, not merely prepared
change-set status:

| Stack | Purpose / important output |
| --- | --- |
| `rct-dotcom-development-release-bootstrap` | Private assets bucket `rct-dotcom-development-release-assets-425061472162-us-east-1` |
| `rct-consulting-development-release-bootstrap` | Private assets bucket `rct-consulting-development-assets-425061472162-us-east-1` |
| `rct-governance-development` | Exact-repository planners, producer compatibility boundaries and governance-owned Founder API/reporting runtime roles |
| `rct-founder-development-release-planning` | Private assets bucket `rct-founder-development-release-assets-425061472162-us-east-1`, release planner and existing singular execution role |
| `rct-founder-development-foundation` | Cognito, API and projection table; `FounderOwnerSubject=disabled` |
| `rct-portfolio-development-eventing` | Portfolio bus/discovery, six queues, reporting worker, two mappings and seven alarms |
| `rct-dotcom-development-foundation` | Private web origin/CloudFront, Cognito, API/core table and web publisher |
| `rct-consulting-development-foundation` | Cognito hosted login/admin group, API/core table/outbox, private web origin/CloudFront and web publisher |

Consulting's explicit parameters are `LeadIntakeEnabled=false`, blank consent
version and `LeadRetentionDays=0`.

The portfolio bus and SSM discovery value are both:
`arn:aws:events:us-east-1:425061472162:event-bus/rct-portfolio-development`.
Discovery parameter: `/rct/development/portfolio/event-bus-arn`.

Useful real Founder role outputs:

- API runtime:
  `arn:aws:iam::425061472162:role/rct/founder/development/runtime/rct-founder-development-api`.
- Reporting runtime:
  `arn:aws:iam::425061472162:role/rct/founder/development/runtime/rct-founder-development-reporting`.
- Release planner:
  `arn:aws:iam::425061472162:role/rct-release/founder/development/rct-founder-development-release-plan`.
- Singular execution role:
  `arn:aws:iam::425061472162:role/rct-release/founder/development/rct-founder-development-execute`.

The last role is the committed, deliberately incomplete execution permission
model, not the pending two-role refinement. Its existence does not certify
infrastructure execution or activate an infrastructure release workflow.

### Live verification and limits

- Both publishers passed lint, workspace checks, contract pins, modern audit,
  actual OIDC assumption, destination ownership/private-origin checks, API
  readiness, build/upload, invalidation and served HTML/every-asset byte checks.
- Both browser landing pages loaded. At a 390-pixel viewport neither had
  horizontal overflow or an intake/enrollment form. The Consulting admin entry
  rendered the configured sign-in button and exact administrator-group gate.
- All three APIs returned their expected application identity at `/health`.
  Anonymous `/me` requests returned 401; Consulting `/admin/leads` and Founder
  `/metrics?month=2026-11` also returned 401.
- Consulting `POST /leads` with an empty JSON body returned 503 while intake was
  closed, before any record creation. Both direct anonymous S3 entry-point
  requests returned 403.
- Reporting Lambda is `Active` with `LastUpdateStatus=Successful` and a
  234,974-byte uploaded ZIP. Both SQS mappings are `Enabled` with
  `ReportBatchItemFailures`.
- Consulting API: `https://7we8owuq3c.execute-api.us-east-1.amazonaws.com`.
  Community API: `https://6bqypilsi0.execute-api.us-east-1.amazonaws.com`.
  Founder API: `https://jjvn8mwbs5.execute-api.us-east-1.amazonaws.com`.
- Consulting hosted-login domain:
  `https://rct-consulting-development-425061472162.auth.us-east-1.amazoncognito.com`.
  No initial admin user, MFA enrollment or authenticated inbox transaction was
  exercised. No synthetic business events were injected into live reporting.

Initial provisioning used the explicitly approved default-profile
administrative bootstrap operator and caller-credential CloudFormation change
sets, with no CloudFormation execution `RoleARN`. Dedicated private asset
buckets and supported `CliCredentialsStackSynthesizer` orchestration avoided
the existing shared `CDKToolkit` bucket/administrator execution role. Shared
bootstrap policies/trust were not modified or assumed. Scoped infrastructure
execution/service-context proofs remain separate unfinished work.

### Budget and deployment lessons

`rct-portfolio-monthly` is configured at $65 USD/month with the exact
`Portfolio=RCT` cost filter, actual percentage thresholds 50/80/100 and forecast
percentage threshold 100, and four verified owner-supplied email subscriptions.
AWS reports budget health `HEALTHY`. **The Portfolio cost-allocation tag is not yet listed by Cost
Explorer, so activation and actual cost attribution are unverified.** Check its
availability, activate that exact tag when available, then verify coverage.
Notification receipt is not verified. This is an alerting budget, not a hard
spending cap. The seven operational alarms have no notification actions.

Three deployment problems were resolved using real AWS evidence:

1. The initial Consulting assets name exceeded S3's 63-character limit.
   Its unexecuted invalid plan was replaced with the shorter name above.
2. API Gateway rejected the Community JWT issuer. CloudTrail showed
   `https://https://...`: Cognito `ProviderURL` already includes HTTPS.
   All three repositories now use it directly with exact template assertions.
   The failed Community stack record was removed; its retained bucket was
   verified owned and empty, including versions/delete markers, then deleted.
3. A foundation-selected Founder assembly skipped reporting bundling and
   incorrectly packaged the source worktree. Lambda rejected its oversized
   archive and eventing rolled back. A fresh `cdk synth '*'` using the pinned
   repository CLI bundled every stack. The reporting asset was verified to
   contain only a 796,118-byte `index.js`; the corrected recreation succeeded.
   The single unusable uploaded archive version and rolled-back stack record
   were removed. Do not deploy unselected-stack ZIP assets from a partial synth.

Session bootstrap scripts, complete assemblies and isolated committed Founder
source remain in this Copilot session's `files/` directory for audit/handoff.
Use `founder-development-complete-assembly`, not the earlier partial assembly,
for eventing evidence. The temporary `node_modules` symlink was removed; restore
appropriate workspace dependencies before resynthesizing isolated source.

## Merged PR and review follow-up (2026-11-06)

- [Consulting PR #5](https://github.com/CteNerd/consulting.wellcall.biz/pull/5)
  and [Community PR #5](https://github.com/CteNerd/community.wellcall.biz/pull/5)
  are merged; their main CI runs passed.
- The deployment issuer fixes are also merged:
  [Consulting #6](https://github.com/CteNerd/consulting.wellcall.biz/pull/6),
  [Community #6](https://github.com/CteNerd/community.wellcall.biz/pull/6), and
  [Founder #9](https://github.com/CteNerd/roddy.tomlin.life/pull/9).
  Copilot reviewed each with no unresolved findings; PR and main CI passed.
  Normal server-side squash merges produced verified GitHub-signed commits,
  without changing branch rules or using administrator bypass.
- Reviewed deployed source trees match signed main commits:
  Consulting `17df0369adf9450940491fba7c745b4e5469531c`,
  Community `d992dc61dcac26cab7f79e9960b145febbe89a75`,
  Founder `40e38a4892e4b7daae5b3c6c26ae34d94f145aa5`.
  Main CI evidence: [Consulting](https://github.com/CteNerd/consulting.wellcall.biz/actions/runs/42246534679),
  [Community](https://github.com/CteNerd/community.wellcall.biz/actions/runs/42246531081),
  [Founder](https://github.com/CteNerd/roddy.tomlin.life/actions/runs/42246475395).
- Four Consulting findings are fixed in source: scheduled outbox validation,
  transaction-only `PutItem` permissions for the three record prefixes,
  exact producer source/detail-type `PutEvents` permissions, and atomic receipt
  replacement/recovery using the same 24-hour expiry cutoff.
- The Community private-origin finding is fixed in both publishers because the
  same preflight was copied into Consulting. Before upload, all four S3 public
  access blocks must be enabled and policy status must explicitly be non-public.
  Only bucket-scoped read permissions were added to each publisher's matching
  identity policy/permissions boundary.
- Review-fix validation: Consulting API/infra type checks and 32 tests passed;
  Community infra type checks and 10 tests passed. Both linters, all four offline
  synths, workflow YAML and embedded Bash syntax checks passed. These remain
  source/CLI checks; the newer live publishing evidence is recorded above.
- Pending Founder feature work remains uncommitted and excluded. Separate
  reviewed PRs are still needed for its execution-permission and dashboard
  slices after current validation and careful integration of overlapping
  documentation changes.

## Repository and branch map

Paths are relative to the sibling repositories' parent directory.

| Repository/worktree | Branch | State at handoff |
| --- | --- | --- |
| `consulting.wellcall.biz/` | `docs/development-activation-handoff` | Report-only follow-up from merged main; deployed features are already merged. |
| `community.wellcall.biz/` | `fix/cognito-issuer-url` | Issuer fix is merged; branch tree matches remote main. |
| `roddy.tomlin.life/` | `feat/founder-execution-permissions` | Existing six-file uncommitted IAM/eventing preparation preserved, not edited or committed here. |
| `roddy.tomlin.life-founder-dashboard/` | `feat/founder-dashboard` | Existing uncommitted dashboard/build/auth changes preserved, not edited or committed here. |

Both original Founder worktrees still have committed baseline `9fda38a`, the PR #8 merge.
Remote Founder main is now `40e38a4`; the isolated issuer-fix source tree matches
that merge. Deployed governance/release/eventing retain the committed PR #8
model, with only the shared issuer fix added. Pending fixed rule/alarm names
and split execution roles were not deployed; their future live changes require
explicit migration/replacement review against the now-existing stacks.
Do not assume the Founder work is saved in commits merely because the producer
branches were pushed. Do not reset, clean, overwrite, or consolidate those
worktrees without first inspecting and preserving their changes.

### Original pushed implementation commits

Consulting:

- `99e44ec`: gated lead intake, transactional lead/idempotency/outbox writes,
  stream publishing, failure handling and scheduled reconciliation.
- `ea4571e`: protected admin lead inbox, listing index, PKCE browser sign-in.
- `7c59dee`: version-checked follow-up statuses, last-editor metadata and
  lead read/update expiry enforcement.
- `3e8feec`: manual development web publisher, scoped OIDC publisher role and
  boundary, development Cognito login domain, release validation and runbooks.
- This report is committed separately on the same branch after those source
  commits; use the branch's current HEAD for the complete PR.

Community:

- `5507bab`: adult application decision gates and aggregate-only approved-mentor event.
- `6f20bbf`: manual development web publisher, scoped OIDC role/boundary,
  release validation and runbooks.

At the original pre-PR inspection, neither feature branch had an open PR. Their commits are unsigned
and both producer `main` branches require signed commits. The owner should
confirm a permitted, verified merge strategy in GitHub, such as an owner-operated
squash merge if offered. Do not force-push/rewrite branches or weaken signature
requirements without approval. The verified merges and hosted CI above supersede
that original readiness gap.

## Completed product work

### Consulting

Relevant source:
[API](../apps/api/src/handler.ts),
[storage](../apps/api/src/lead-store.ts),
[lead validation](../apps/api/src/leads.ts),
[public form](../apps/web/src/LeadForm.tsx),
[admin inbox](../apps/web/src/AdminInbox.tsx),
[PKCE login](../apps/web/src/admin-auth.ts),
[follow-up labels](../packages/domain/src/lead-follow-up.ts).

- Public inquiry form and `POST /leads` exist but default closed.
  Explicit approved consent copy/version, retention and enable settings are
  necessary; no policy wording was invented.
- Input bounds, exact consent version, honeypot, stage throttling and
  idempotency protect submission. Lead, receipt and sanitized outbox event
  are written in one conditional DynamoDB transaction.
- DynamoDB Streams select only OUTBOX inserts. EventBridge events contain
  aggregate counts/months, not contact details. Stream failures go to a
  failure queue; a scheduled pending-index query retries undelivered events.
- `GET /admin/leads` requires Gateway-verified Cognito JWT claims plus the
  exact `ConsultingAdministrators` group. Listing uses a bounded, validated
  cursor and a sparse lead index; at most 25 evaluated records per page.
- The gated inbox uses authorization-code PKCE and in-memory access tokens.
  It displays confidential inquiry details, pagination and explicit errors.
- `PATCH /admin/leads/{leadId}` accepts only a known status and expected version.
  New, Contacted, Qualified and Closed are reversible follow-up labels, not
  project/finance authorization or automatic customer contact.
- Conditional writes prevent stale overwrites and missing/expired-lead updates.
  Last editor and time remain on the domain record; retention is not extended.
  No follow-up PII is published to the portfolio bus.
- Expired leads are excluded from listing while TTL deletion is pending.
  Empty expiry-filtered pages can still have a next-page token.
- GSI reads are eventually consistent. Confirmed writes update the visible
  card immediately, but a manual refresh may briefly show older index state.

### Community

Relevant source:
[adult application decisions](../../community.wellcall.biz/packages/domain/src/adult-application.ts),
[assignment authorization](../../community.wellcall.biz/packages/domain/src/authorization.ts).

- Approval requires trusted verified adult eligibility and current consent.
  Mentor approval additionally requires completed screening.
- Participant approval does not emit a mentor-count event.
- Approved-mentor reporting is aggregate-only.
- Repeated terminal decisions are prevented.
- These are domain rules, not authenticated operational API routes or
  persistence. Public application/enrollment remains closed.
- Youth enrollment, guardian consent, safeguarding and verified screening
  processes are still prerequisites, not implemented capabilities.

### Personal / Founder: pending feature work

The earlier dashboard slice in the separate worktree includes a standalone
Founder UI, PKCE login, authenticated month-specific aggregate reporting,
safe empty/error states and release-output checks. It is configuration-gated,
not deployed, and remains uncommitted.

The original worktree has pending execution-permission/eventing refinements in:
`infra/src/eventing.ts`, `infra/src/eventing.test.ts`,
`infra/src/release-planning.ts`, `infra/src/release-planning.test.ts`,
`infra/README.md`, and `docs/portfolio-implementation-status.md`.

The dashboard worktree additionally has changes to root manifests/lockfile,
lint/build/release configuration, infrastructure config/stack/tests, documentation,
and the untracked `apps/founder-web/` tree.

Prior recorded dashboard checks passed before this final increment; they were
not rerun here. The next session must review and revalidate both worktrees before
committing or combining them.

## Development release preparation completed

Source in each producer:

- `.github/workflows/publish-development.yml`
- `infra/src/web-release.ts`
- `infra/src/check-web-release.ts`
- `infra/src/web-release.test.ts`
- Updated `infra/src/stack.ts` and `stack.test.ts`
- Updated root README and infrastructure runbook.

The workflow is manual (`workflow_dispatch`), `main`-only and uses the existing
GitHub `development` environment. It does not run automatically on feature
pushes or merges and cannot provision/update infrastructure.

Development stacks now define a dedicated web publisher. Its managed policy is
both the identity grant and permissions boundary:

- List the own bucket and read its location.
- GetObject/PutObject only `assets/*` and `index.html`.
- Read/invalidate only the own CloudFront distribution.
- Describe only the own CloudFormation stack.

The role cannot delete objects, change bucket policies/distributions, mutate
application data, manage IAM or execute CloudFormation changes. It imports the
existing OIDC provider rather than recreating it. Trust is exact repository,
development environment and STS audience. These publisher roles are not
defined in production stacks.

The workflow:

1. Rejects missing variables, other repositories/branches/events, production
   roles and the synthetic CI account before requesting AWS credentials.
2. Runs modern checks, contract pin verification and the high-severity audit.
3. Assumes the scoped publisher via OIDC for a short-lived session.
4. Validates deployed stack identity/status/outputs and publisher-role match.
   Consulting also requires the stack's public lead-intake flag to be false.
5. Checks bucket ownership, the private S3/OAC origin, API health and anonymous
   denial of the protected route.
6. Builds only the modern web preview; Consulting gets public browser login
   settings from stack outputs while public intake remains disabled.
7. Uploads hashed assets before the entry point, without deleting old assets.
8. Waits for invalidation, then compares the served HTML and every emitted asset
   byte-for-byte with the build before reporting the preview URL.

Consulting development source also creates a Cognito hosted-login domain and
exposes `AuthUrl`. The client callback/logout use the site root, avoiding SPA
path-fallback requirements. No initial users or group membership are created.
Community gains no login/application UI in this slice.

The two publishers remain independently owned repository implementations.
They support generated CloudFront and API Gateway URLs only; custom-domain
activation requires a reviewed extension and separate DNS approval.

## Historical read-only environment findings (before activation)

Checked before PR creation/provisioning on 2026-11-06; superseded by the verified
activation above:

- Default AWS profile successfully authenticated through STS.
- Existing GitHub OIDC provider includes `sts.amazonaws.com`.
- `rct-consulting-development-foundation` does not exist in that account.
- `rct-dotcom-development-foundation` does not exist in that account.
- Both GitHub `development` environments exist and have the single explicit
  deployment branch policy `main`.
- Both development environments have no configured environment variables.

No AWS write, role assumption through the new publisher, GitHub variable/secret
write, workflow dispatch, DNS change, or infrastructure deployment was performed.
Infrastructure create permissions and service-provided contexts were not
certified by these read-only findings.

## Release configuration reference (now configured)

In **each producer repository**:
Settings > Environments > development > Environment variables.

| Variable | Required value |
| --- | --- |
| `AWS_ACCOUNT_ID` | The verified real 12-digit deployment account; do not use `123456789012`. |
| `AWS_WEB_PUBLISH_ROLE_ARN` | The corresponding deployed development stack's `WebPublishRoleArn` output. |

**No AWS access-key secrets or Cognito client secret are required.** The browser
OAuth client is public. Do not create long-lived credentials for GitHub.
The workflow fixes region to `us-east-1`; bucket, distribution, API and Consulting
browser settings come from validated deployed outputs.

Setting variables alone does not provision resources. The role ARN is not an
active identity until the reviewed stack has been created. Follow
[Consulting runbook](../infra/README.md#manual-development-web-releases) and
[Community runbook](../../community.wellcall.biz/infra/README.md#manual-development-web-releases).
Neither workflow reads `AWS_DEPLOY_ROLE_ARN`; infrastructure deployment is a
separate task.

## Original source-only verification (before activation)

| Check | Consulting | Community |
| --- | --- | --- |
| `npm run check:foundation` | Passed: 49 tests plus workspace type checks | Passed: 24 tests plus workspace type checks |
| Infrastructure workspace lint | Passed | Passed |
| `npm run build:web` | Passed | Passed |
| `npm run test:contracts` | Passed; pin digests verified | Passed; pin digests verified |
| Modern-workspace audit at `--audit-level=high` | Passed; 10 moderate findings remain | Passed; 10 moderate findings remain |
| Development and production offline synth | Both passed | Both passed |
| Workflow YAML and embedded Bash syntax | Passed | Passed |
| Diff whitespace checks | Passed | Passed |

New tests cover exact trust/boundary wiring, absence of publisher grants in
production, invalid release context/destinations, role drift, unfinished stacks,
duplicate outputs, private-origin checks, API identity and actual CLI output/error
behavior. Community's health validator is checked against its actual API handler,
whose public application identifier is `community` even though resource names
use the stable `dotcom` prefix.

Earlier Consulting browser checks verified the closed configuration gate and a
synthetic status-save interaction. Auth/data were mocked for that interaction;
it was not a live Cognito or DynamoDB test. Temporary preview servers and mocks
were removed. Shared local browser tabs are not evidence of public hosting.

Still not verified after activation:

- Hosted login/MFA and authenticated API access.
- Real lead concurrency/expiry/TTL deletion and notification/recovery behavior.
- End-to-end EventBridge-to-Founder delivery or outage replay.
- Producer DynamoDB Local integration: Docker was not running and Java was
  unavailable for a fallback. Storage command-shape/unit tests are not a
  deployed-database rehearsal.

Synth still reports unconfigured CDK feature flags. Do not bulk-change them
without reviewing behavioral implications.

GitHub push notifications reported broad default-branch dependency alerts:
Consulting 138, Community 153, including high/critical legacy findings. Those
are not equivalent to the narrower passing modern-workspace audit and were not
remediated here. Do not run forced audit fixes or certify the legacy CRA graph.

## Remaining work, in recommended order

### 1. Resume feature development

- Do not repeat producer PR creation, initial foundation/eventing bootstrap or
  publisher variable setup: those are complete.
- Preserve and validate the existing Founder dashboard/execution slices,
  integrate overlapping files deliberately, and create their separate PRs.
- Continue Community's gated adult application/review flow and Consulting's
  operational features below without inventing policy approvals.
- After merging future web changes, manually dispatch the corresponding
  development publisher and verify its result. Production is not activated.

### 2. Exercise the secure Consulting admin pilot

- Provision a Consulting admin account/group membership through an authorized
  operator. Exercise MFA, PKCE, anonymous denial and authenticated inbox access.
- Browser-test authenticated inbox empty/error/status-save states and refresh
  behavior against the live API. Initial landing/admin-gate and asset checks are
  already complete. Production and DNS remain separate approvals.

### 3. Finish the Consulting intake operation

- Approve consent wording/version and retention policy before any public enable.
- Add operational lead notifications and ownership/follow-up processes.
- Review abuse controls (CAPTCHA/WAF/rate-limit posture), access logging and
  escalation requirements.
- Add/execute real database tests for retries, lost acknowledgement,
  concurrent status updates, missing/expired records and pagination.
- Exercise outbox failure queues, reconciliation, sanitized reporting delivery,
  recovery and actual physical retention/deletion.
- Add trusted project/membership/assignment loaders before project, time or
  finance CRUD. Existing pure authorization policies are not endpoints.

### 4. Implement the Community operational adult pilot

- Approve consent, screening, eligibility verification, retention and concern
  escalation policies. Do not treat self-attestation as verified eligibility.
- Implement gated application persistence and authenticated review actions
  using trusted server-loaded records.
- Wire an atomic application/decision/outbox transaction and sanitized
  approved-mentor publishing with retry/reconciliation safeguards.
- Add review UI, mentor/participant assignments, notifications and operational
  tests. Keep public enrollment and all youth participation gated.

### 5. Preserve and complete Founder work

- Review the two dirty worktrees independently; commit each cohesive slice only
  after current checks/builds and release-output validation.
- Plan their integration order; shared runbooks/status files need careful merge.
- Finish reviewed execution permissions and live service-context proofs.
- Configure the approved Founder owner subject and dashboard login/hosting/routing
  against the existing API; do not repeat its initial provisioning.
- Verify aggregate-only monthly reports with real producer delivery, replay and
  recovery. The existing manual profile publisher does not publish the Founder
  dashboard or configure its owner-access gate.

### 6. Production readiness is a later gate

Protected production approval, domain/brand/cutover approval, approved policies,
cost/notification receipt, least-privilege infrastructure automation, smoke
tests and restore/rollback rehearsals are still required. Do not activate
production by changing an environment variable or reusing development grants.

## Suggested instruction for the next Copilot session

> Read `consulting.wellcall.biz/docs/development-handoff-2026-11-06.md` and both
> producer infrastructure runbooks. Inspect all branch/worktree states before
> editing and preserve the uncommitted Founder work. Producer development
> previews, real publisher ARNs/variables and the initial shared development
> foundations are already deployed and verified; do not redo that bootstrap.
> Resume the pending Founder feature slices and remaining Community/Consulting
> product work, reviewing changes against the live stacks before infrastructure
> updates. Keep intake/enrollment and Founder owner access closed,
> use OIDC rather than stored AWS keys, and distinguish source-tested preparation
> from deployed, verified behavior. Then resume the remaining product work in
> the priority order above.
