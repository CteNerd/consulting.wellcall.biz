# Portfolio development and release handoff

Date: 2026-11-06.
Scope: Consulting, Community, and the two existing personal/Founder worktrees.

## Executive status

Meaningful product features are implemented and pushed for Consulting.
Community has tested adult-approval domain logic, but not an operational
application flow. This final increment prepares manual development web publishers
for both producers and a development-only Cognito login domain for Consulting.

**Nothing in this session created AWS resources, deployed an application, changed
DNS, configured GitHub variables/secrets, opened enrollment, or enabled public
lead intake.** Neither producer development stack exists in the default AWS
profile's account as of the read-only check below. Merging runs CI; it does not
automatically create those stacks or publish a preview.

The new publishing workflows become usable only after merge, reviewed initial
infrastructure provisioning, and two development environment variables per repo.
PR creation is the next step; no PR was created by this increment.

## Repository and branch map

Paths are relative to the sibling repositories' parent directory.

| Repository/worktree | Branch | State at handoff |
| --- | --- | --- |
| `consulting.wellcall.biz/` | `feat/consulting-lead-intake` | Product and development-release commits pushed; this report lives on the same branch. |
| `community.wellcall.biz/` | `feat/community-adult-mentorship` | Adult approval and development-release commits pushed. |
| `roddy.tomlin.life/` | `feat/founder-execution-permissions` | Existing six-file uncommitted IAM/eventing preparation preserved, not edited or committed here. |
| `roddy.tomlin.life-founder-dashboard/` | `feat/founder-dashboard` | Existing uncommitted dashboard/build/auth changes preserved, not edited or committed here. |

Both Founder worktrees have committed baseline `9fda38a`, the PR #8 merge.
Do not assume the Founder work is saved in commits merely because the producer
branches were pushed. Do not reset, clean, overwrite, or consolidate those
worktrees without first inspecting and preserving their changes.

### Pushed implementation commits

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

At inspection, neither feature branch had an open PR. Their commits are unsigned
and both producer `main` branches require signed commits. The owner should
confirm a permitted, verified merge strategy in GitHub, such as an owner-operated
squash merge if offered. Do not force-push/rewrite branches or weaken signature
requirements without approval. Local test results below are not GitHub PR checks.

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

### Personal / Founder: existing work, not changed here

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

## Read-only environment findings

Checked on 2026-11-06:

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

## Exact variables and secrets the owner needs

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

## Verification performed for this final increment

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

Not verified:

- Actual GitHub workflow execution or PR CI on these branches.
- Assumption of deployed publisher roles and actual permission enforcement.
- Live CloudFront publishing, hosted login/MFA and authenticated API access.
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

### 1. PR review and merge producer source

- Open separate PRs from the two feature branches to each repo's `main`.
- Run required CI and Copilot review; address linked findings without mixing
  unrelated Founder changes.
- Confirm signature/merge requirements and resolve review conversations.
- Do not describe this as a production release or an activated pipeline.

### 2. Establish a real development preview

- Review the complete CDK templates, cost/budget notifications, ownership,
  bootstrap, CloudFormation execution and pass-role boundaries.
- Provision the development foundation stacks through authorized, reviewed
  infrastructure access. Do not grant the web publisher infrastructure access
  or borrow/widen the shared administrator bootstrap role.
- Consulting needs the portfolio EventBridge bus and its SSM discovery ARN
  provisioned first, or a separately reviewed development-only eventing plan.
  A web publisher cannot supply that dependency.
- Configure the two environment variables from verified identity/stack outputs.
- Confirm exact development environment/branch protections and OIDC role trust.
- Dispatch the new workflow on `main`; verify its real checks and preview URL.
- Provision a Consulting admin account/group membership through an authorized
  operator. Exercise MFA, PKCE, anonymous denial and authenticated inbox access.
- Browser-test the deployed entry point, assets, navigation, admin empty/error
  states and refresh behavior. Production and DNS remain separate approvals.

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
- Configure the Founder owner subject, login, hosting/routing and API.
- Verify aggregate-only monthly reports with real producer delivery, replay and
  recovery. Existing manual profile publishing on committed `main` does not
  activate the Founder runtime.

### 6. Production readiness is a later gate

Protected production approval, domain/brand/cutover approval, approved policies,
cost/notification receipt, least-privilege infrastructure automation, smoke
tests and restore/rollback rehearsals are still required. Do not activate
production by changing an environment variable or reusing development grants.

## Suggested instruction for the next Copilot session

> Read `consulting.wellcall.biz/docs/development-handoff-2026-11-06.md` and both
> producer infrastructure runbooks. Inspect all branch/worktree states before
> editing, preserve the uncommitted Founder work, and start with PR readiness
> and the reviewed development-preview bootstrap. Keep intake/enrollment closed,
> use OIDC rather than stored AWS keys, and distinguish source-tested preparation
> from deployed, verified behavior. Then resume the remaining product work in
> the priority order above.
