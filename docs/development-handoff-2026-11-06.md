# Portfolio development and release handoff

Date: 2026-11-06.
Latest operational update: 2026-11-09.
Scope: Consulting, Community, and the two existing personal/Founder worktrees.

## Executive status

**Both producer development previews are deployed and verified.** Their real
publisher roles exist, both required GitHub development variables are
configured, and the manual OIDC publishing workflows passed. Development
hostnames are now active for both previews. Founder governance, release
planning, API/projections and portfolio reporting/eventing are also provisioned
in development.

Consulting has gated lead intake, a protected admin inbox, versioned follow-up
statuses and deployed project/task/time infrastructure. Community application/
review/outbox infrastructure is now deployed in development with both required
indexes active; enrollment remains closed. Founder dashboard
[PR #10](https://github.com/CteNerd/roddy.tomlin.life/pull/10) and execution-role
[PR #11](https://github.com/CteNerd/roddy.tomlin.life/pull/11) are now merged
after review fixes and passing CI. The original Founder worktree contents are
preserved in pushed archive branches; their older contents must not overwrite
reviewed `main`.

**Public intake, enrollment and Founder owner access remain closed.** No initial
Cognito users were created. Production provisioning and public branding are now
owner-approved. Third Down's production website and API are live after an
explicitly approved protected promotion. CUT BLOCK's production foundation and
API are deployed; its website candidate is staging. Founder production API
is healthy with owner access disabled; reporting and frontend release gates
remain pending. Merging runs CI, not an automatic production deployment.

The current activation sections below supersede the explicitly historical
source-only snapshots later in this report. Feature development can resume
without repeating this initial infrastructure bootstrap.

## Development continuation

### Approved production rollout in progress (2026-11-09)

The owner explicitly approved all three applications and backend infrastructure,
publication of the current branding, and production domains `thirddowntech.com`
and `cutblock.org`. Preserve the existing `roddy.tomlin.life` profile and add its
`/founder` integration only after the release gates pass. Public intake,
enrollment and Founder owner access must remain closed until actual UAT passes.
This supersedes earlier production/DNS holds, not data/access protections or
protected-environment approval.

All operations use verified account `425061472162`, region `us-east-1`.
Existing development bootstrap and original Founder archive worktrees were
preserved. Production governance and isolated release storage are provisioned.
No shared `CDKToolkit` administrator executor was used.

Reviewed production source:

- Consulting [PR #10](https://github.com/CteNerd/consulting.wellcall.biz/pull/10),
  main `524456e7c5d83168defa9c2e3370912f22725ce4`.
- Community [PR #8](https://github.com/CteNerd/community.wellcall.biz/pull/8),
  main `5ccbc6fdb52aa1c920008163c230757e77f74bb7`.
- Founder permission repairs through [PR #16](https://github.com/CteNerd/roddy.tomlin.life/pull/16),
  main `91bafec9e5085b4e50bad474bd2af53017e365f1`.

Consulting development migration `reviewed-migration-524456e` is
`UPDATE_COMPLETE`: health 200, anonymous protected routes 401, closed intake
503. The existing development alias/certificate were preserved. Its production
foundation `approved-production-524456e` is `CREATE_COMPLETE`, with real apex/
API certificates and DNS. Production health is 200, protected routes 401,
intake 503, invitation-only MFA enabled and zero users.

The owner explicitly approved the exact immutable candidate in
[production run 42667638468](https://github.com/CteNerd/consulting.wellcall.biz/actions/runs/42667638468)
after successful development staging. Candidate artifact SHA-256 is
`19fcbe13ca831334ed5e305f3ffd1df9ce16b8bd832fa34409dd2b9a5aa912e8`.
All candidate/stage/production jobs passed; production promoted the same bytes,
without rebuilding. `https://thirddowntech.com` is live with approved branding,
selfware messaging and intake closed. Browser checks at 1440px and 360px found
no horizontal overflow or development-preview wording.

Community's first full development update rolled back safely because DynamoDB
cannot add two indexes in one UPDATE. Table-only intermediate change sets
`first-reviewed-community-index` and `second-reviewed-community-index` each
added one exact reviewed index, with no table replacement or other resource
changes. Both `CommunityApplicationsIndex` and `OutboxPendingIndex` reached
`ACTIVE` before `reviewed-community-runtime-pr8` installed dependent runtime.
Development is now `UPDATE_COMPLETE`: health 200, protected routes 401,
`/internal` 200/noindex, original alias/certificate unchanged, intake false,
consent empty and retention zero. The additive production change set
`approved-community-production-pr8` is `CREATE_COMPLETE` with those same closed
gates. Production custom-domain health is 200, protected routes 401,
invitation-only MFA enabled and zero users. Website candidate
[run 42675288861](https://github.com/CteNerd/community.wellcall.biz/actions/runs/42675288861)
is staging; no public-site completion is claimed yet.

Founder managed-login/API collection repairs were merged as PRs #13/#14.
The separately approved exact-stage compatibility grant passed a real temporary
development API plus tagged `$default` stage canary through the bounded API
executor; the temporary stack was deleted. Development was rebound to owned
API `jjvn8mwbs5`, production to independently verified `81qhxlwk68`.
Production foundation is now `UPDATE_COMPLETE`: health 200, anonymous metrics
401, original protected/PITR-enabled empty table and invitation-only MFA pool
preserved, zero users and owner `disabled`. No profile hosting or owner access
was activated.

Production reporting/eventing remains preserved in `UPDATE_FAILED`: its two
tagged mappings still fail authorization after PR #15. AWS action metadata
shows `lambda:FunctionArn` is unsupported for `TagResource`, and existing
development mappings carry three reserved CloudFormation tags in addition to
portfolio/environment. [PR #18](https://github.com/CteNerd/roddy.tomlin.life/pull/18)
replaces that unsatisfiable tag condition with exact stack/logical-ID ownership
and requires real bounded development creation before production retry.
[PR #17](https://github.com/CteNerd/roddy.tomlin.life/pull/17) prepares a separately
protected Founder-prefix frontend release; dedicated publisher and existing-host
routing integration must be reviewed before publishing `/founder`.

Separate a **public-site launch with collection closed** from **live workflow
activation**. Neither requires completing every future C2/D2 feature:

- Both producers now have immutable, separately scoped protected production
  promotion workflows. Development infrastructure migrations are complete;
  publishing HTML alone is still not an API deployment. Configure each
  environment's publisher from its matching stack output and retain main-only
  policies and required production review.
- Founder frontend integration and reporting repair remain separate release
  gates. The separate existing profile
  `aws-production` environment has branch restrictions but no reviewer rule;
  do not treat it as the protected new-Founder promotion path.
- Real workflows additionally require approved memberships/assignments,
  Founder owner/MFA provisioning, consent/retention/readiness decisions and
  live authentication, access-denial and event-delivery/recovery UAT.
  Synthetic browser flows and isolated database tests do not prove these.
- Operational acceptance still needs notification/budget delivery evidence,
  monitoring/DLQ recovery and rollback/restore evidence. Public branding is
  approved; source CI is not evidence that live operating gates passed.

The shortest safe route is reviewed merges, a controlled development migration
and hosted smoke/UAT, then the approved marketing-only production
launch with collection/access still closed. Activate real-user workflows
separately after their data/access/operating gates pass. Do not repeat the
already completed development bootstrap.

### Local acceptance rehearsals now available

Use synthetic data only. Do not enter real client/participant details, clinical
information, credentials or confidential business documents into these
rehearsals. They are opt-in loopback development modes, not live-user access
or a regulatory-compliance claim.

| Workflow | Running local URL | Restart command, from the corresponding repository |
| --- | --- | --- |
| Consulting project/task/time | `http://127.0.0.1:5186/?workspace&uatRehearsal=1` | `npm run dev:uat --workspace @rct/consulting-web` |
| Community adult applicant/reviewer | `http://127.0.0.1:5185/internal` | `npm run dev:uat --workspace @rct/community-web` |
| Founder read-only reporting | `http://localhost:5184/founder/` | `npm run dev:uat --workspace @rct/founder-web` in the isolated UAT worktree |

- Consulting now supports actual API-backed editing of own drafts and correction
  of rejected time. Correction returns the entry to draft, clears current
  review fields and retains immutable audit history; submitted/approved time
  is read-only. The local rehearsal can switch contributor, manager,
  administrator and unassigned personas and exercise tasks, stale versions,
  rejection/correction/resubmission and approval. Scripted browser checks
  exercised correction, submission, manager approval and removal of data for
  unassigned users, with mobile overflow checks.
- Community now has configuration-gated applicant receipt/status/submission/
  withdrawal and administrator review screens over the existing API contracts.
  The rehearsal exercises synthetic mentor/participant and reviewer roles;
  browser checks followed submission, adult verification, screening and
  approval through versions 0–3. Public/default pages remain closed and have
  no enrollment form. Development hosted-login and exact `/internal` route
  rewriting are source-only and require reviewed migration.
- Founder rehearses absent versus observed-zero projections, signed totals,
  period selection and expired/unavailable/malformed responses. Errors remove
  stale cards; no source-record or participant details are exposed.
- Production build checks exclude synthetic fixtures/persona bypass in all
  three applications. Normal previews retain their configuration/access gates.
  These local client-side rehearsals do not validate real Cognito, live IAM,
  EventBridge or operating procedures.
- Consulting's owner-directed software / “selfware” section is on the existing
  Approach page. It distinguishes owner-written bounded requests from deeper
  engineering/integration work, includes build-versus-buy tradeoffs and states
  that AI is not compliance. No customer/person attribution or regulated-system
  certification is published.

Current source validation: Consulting 119 foundation tests and Community
65 foundation tests passed, with lint, pins, production builds and both offline
environment synths. Founder workspace checks and 42 UI/profile/release-boundary
tests passed. Real DynamoDB Local integration evidence is recorded below;
browser simulations are not presented as database/authentication certification.

### Progress protection and UAT scope (2026-11-09)

The verified baseline is now committed and pushed:

- Consulting: `feat/consulting-uat-workflows-20261109`,
  checkpoint `89a5da2` (107 foundation tests, lint and web build passed).
- Community: `feat/community-uat-workflows-20261109`,
  checkpoint `c48a8d8` (45 foundation tests, lint and web build passed).
- Founder continuation uses a new isolated `roddy.tomlin.life-uat` worktree
  and `feat/founder-uat-workflows-20261109`, based on reviewed `e035a34`.
  Both original Founder working-copy contents remain unchanged. At the owner's
  subsequent request to commit/push all 29 remaining changes, their exact
  pre-review versions were saved as `8427bfe` on
  `archive/founder-execution-worktree-20261109` and `88e3771` on
  `archive/founder-dashboard-worktree-20261109`. Both original worktrees are
  now clean. These archives are preservation-only, not merge candidates:
  PRs #10/#11 already contain reviewed replacements. New Founder development
  continues on the validated UAT branch.

Credential-free checks now also run on `feat/**` pushes in all three
repositories, so protecting progress does not require opening a PR. Check jobs
retain only `contents: read`; deployment workflows and production approval
rules are unchanged. Source pushes are not a merge or a deployment.

Verified feature-push evidence:

- Consulting workflow source checkpoints `f1ec837` and `97a1b0e` are pushed.
  [42622238514](https://github.com/CteNerd/consulting.wellcall.biz/actions/runs/42622238514)
  passed all foundation/build/synth checks and the actual DynamoDB Local
  workspace integration: draft/edit/submit/reject/correct/resubmit/approve,
  stale writes, unassigned/self-review denials, immutable retention of seven
  contributor transitions and no reporting outbox. Three tests passed with
  zero failures/skips in a unique cleaned-up local table with fake credentials.
- Community
  applicant/reviewer source checkpoint `96fd275` is pushed.
  [42622233413](https://github.com/CteNerd/community.wellcall.biz/actions/runs/42622233413)
  passed foundation checks and real DynamoDB Local application integration:
  duplicate submission recovery, cross-applicant denial, one winner in racing
  withdrawals, retention enforcement before TTL deletion, and prerequisite-
  checked mentor approval with exactly one sanitized outbox record.
  Five tests passed with zero skips. This proves local database transactions,
  not live JWT validation, IAM, EventBridge delivery or safeguarding.
- Founder UAT checkpoint `73e7852` and
  [42620285730](https://github.com/CteNerd/roddy.tomlin.life/actions/runs/42620285730)
  passed profile/workspace checks and isolated reporting integration. The
  synthetic dashboard fixtures are absent from production Founder and public
  profile artifacts.

The actual DynamoDB tests ran in isolated hosted CI containers, not against
live AWS or the local Mac (whose Docker daemon/JVM is unavailable). The checked
source heads above are feature-branch checkpoints, not published releases.

The Founder rehearsal is running at `http://localhost:5184/founder/`.
To restart it, run `npm run dev:uat --workspace @rct/founder-web` from the
isolated Founder UAT worktree. Select January 2026 for absent projections,
September 2026 for an observed zero, or November 2026 for populated/signed
totals. The response selector exercises expired sessions, unavailable service
and malformed aggregate data; each error removes stale report cards.
Desktop/mobile browser checks exercised these actual UI paths. It is explicitly
synthetic and read-only, without live data or owner access.

This increment provides opt-in loopback-only synthetic workflow rehearsals
and closes source UI/workflow gaps. Synthetic personas, consent,
screening, project data and aggregate totals must be clearly labeled and
excluded from production web artifacts. They must never send requests or
events to live AWS. These rehearsals are not proof of Cognito, persistence,
event delivery, safeguarding readiness or regulatory compliance. Real-user
UAT and live activation still require separately reviewed configuration and
operational approval.

Read-only live checks on 2026-11-09 returned healthy identities for all three
development APIs and 401 for anonymous Consulting/Community identity requests
and Founder metrics. No user, application, project, event or access grant was
created.

The approved CUT BLOCK brand meaning is **Come Up Through Building, Learning,
Opportunity & Competition**. Public-site work must use that exact phrase rather
than invent a different expansion. CUT BLOCK and Third Down Technologies remain
provisional display brands, not legal-clearance or operating-program claims.

Both public sites have substantial source-only updates:

- CUT BLOCK prominently explains the approved meaning, its story, technology/AI
  and mentorship paths, the guided-practice model, readiness boundaries and six
  FAQs. Athletics, fitness and facilities remain future concepts.
- Third Down has 13 public routes covering small business, enterprise, five
  service offerings, engagement options/process, about, FAQ and discovery
  preparation. The existing gated lead/admin UI is preserved; contact
  preparation does not collect inquiries or book appointments.
- Both sites retain `noindex, nofollow`, closed intake/enrollment notices and
  provisional-brand language. Production-build browser checks at 320, 390 and
  1440 pixels found no horizontal overflow in the tested journeys; navigation
  and keyboard FAQ interaction were exercised.
- Community's modern foundation checks (59 tests), existing foundation linter,
  contract pins, web build and both offline synths passed. Third Down's web
  checks (53 tests), contract pins and web build passed. Consulting API
  (39 tests), domain (9 tests), infrastructure (12 tests), lint and both
  offline synths also passed.
  Current combined foundation totals are 119 Consulting tests and 59 Community
  tests, with no failures.

These are local source/build results, not a CloudFront release. Existing
development domains still serve the last published revision until reviewed
changes reach `main` and its manual development publisher succeeds. The existing
Consulting distribution has no SPA rewrite: the source now adds an exact
13-route viewer-request rewrite, preserving queries and origin errors for
unknown paths/assets. A web-only publish cannot enable that rewrite. A separately
reviewed infrastructure migration must preserve its live development alias and
certificate before hosted page refresh can be certified. Verify hosted deep
links and served assets after release. Do not copy locally
generated API configuration into a public artifact or bypass the publisher.
On 2026-11-09 the owner authorized regular feature-branch commits and pushes
to protect progress, without opening PRs. This supersedes the previous
local-only instruction. Merge, infrastructure/web publishing, production/DNS
and real intake/enrollment/owner activation remain separately gated.

Consulting's C2 backend source now persists project assignments, tasks and own
time drafts/submission, with manager review and no self-approval. Each request
loads active app membership and active project assignment; writes conditionally
check trusted state/version and add audit records. Contributor queries stay
within their own/assigned scope. There is no finance access or new reporting
event contract. Reviewed membership/project/initial manager data,
`WorkspaceIndex` migration/backfill, time retention and live authenticated
rehearsal remain gates. The authenticated `/?workspace` UI now integrates
assigned projects/tasks, manager assignment/task controls, own time
draft/submission and manager review, including own draft editing and rejected
time correction. API denials and stale versions are shown explicitly; expired
sessions clear workspace data. Assignment revocation, document upload and
approved-time correction/reversal are not implemented. These source features
are not deployed. Local browser checks
confirmed the workspace fails closed without auth configuration and has no
horizontal overflow at 320/390/1440 pixels; authenticated paths are covered by
tests, not a live Cognito/DynamoDB rehearsal.

Local-only development servers are available at
`http://127.0.0.1:5175/` (CUT BLOCK) and
`http://127.0.0.1:5176/` (Third Down, with `/?workspace` for its gated entry).
Both were checked to return HTTP 200. These loopback previews do not change
the CloudFront sites or enable access to real project data.

Community's source now also supports owner-only application status and
version-checked withdrawal of pending applications. Applicant responses omit
reviewer identities, screening details and contact data. Withdrawal checks
ownership, status, version and retention expiry together, removes the review
queue entry and emits no mentor-approval event. It does not revoke an approved
mentor. Intake remains disabled, and these backend changes are not deployed.

Founder PR review fixes separate dashboard artifacts from the public profile,
handle expired metrics sessions, permit safe signed financial totals and refine
the scoped execution policies. Their merge is not a deployment or permission
to enable Founder owner access. The live resource inventory and historical
implementation snapshots below must not be interpreted as current source state.

## Verified development activation

Account: `425061472162`. Region: `us-east-1`.

| Application | Live preview | Successful publishing run |
| --- | --- | --- |
| Consulting | [Development site](https://d38dz368foep1n.cloudfront.net/) / [admin entry](https://d38dz368foep1n.cloudfront.net/?admin) | [42248813337](https://github.com/CteNerd/consulting.wellcall.biz/actions/runs/42248813337) |
| Community | [Development site](https://d3rh9e476mucty.cloudfront.net/) | [42247345620](https://github.com/CteNerd/community.wellcall.biz/actions/runs/42247345620) |

### Development custom hostnames

On 2026-11-06, AWS CLI changes enabled these dev-only URLs:

| Application | Custom hostname | CloudFront distribution | ACM certificate |
| --- | --- | --- | --- |
| Consulting | [https://dev.thirddowntech.com](https://dev.thirddowntech.com/) | `E1ME23HJAUQXEW` | `arn:aws:acm:us-east-1:425061472162:certificate/f188b0ef-39b4-4020-8c95-1b11a586942f` |
| Community | [https://dev.cutblock.org](https://dev.cutblock.org/) | `E4QU10N4MNZ30` | `arn:aws:acm:us-east-1:425061472162:certificate/9db61a17-da37-4d4a-a4a4-297344ef0d1f` |

Both hostnames have DNS-validated ACM certificates in `us-east-1`, CloudFront
aliases with TLS 1.2, and Route 53 A/AAAA aliases to their existing
distributions. HTTPS returned 200 with certificate verification, and each
custom hostname served byte-identical HTML to its generated CloudFront URL.
Only the two development subdomains changed; no apex, API, or production DNS
records were touched. CloudFormation drift detection reported `IN_SYNC` for
both development stacks.

The hostname/DNS changes were applied directly with AWS CLI; the current stack
outputs and deployed main-branch publishers still use generated CloudFront
URLs. The dirty source branches now allow only the corresponding exact dev
hostname as an alternative and verify its CloudFront alias and ACM/TLS settings.
That validator change is source-only until reviewed and merged. Before a future
infrastructure update, review a change set and reconcile the stack and
publisher behavior; do not deploy a default configuration that removes or
breaks these aliases.
Consulting Cognito callback/logout URLs also still use its generated CloudFront
URL, so authentication redirects have not been switched to the custom hostname.

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
| `community.wellcall.biz/` | `fix/cognito-issuer-url` | Issuer fix is merged; this session added uncommitted, source-only gated adult application/review changes. No deployment or preview publish. |
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
- Source now includes JWT-protected adult application submission, an
  administrator-group review inbox and version-checked eligibility, screening
  and decision transitions. New submissions atomically write an application
  and a 24-hour idempotency receipt; mentor decisions atomically write the
  application update and sanitized reporting outbox event. A stream publisher
  and scheduled reconciliation relay only strict aggregate approval events.
- Intake is still disabled by default (blank consent version and zero retention),
  no administrator members or application UI are provisioned, and no youth
  routes exist. None of these source changes are deployed to the existing
  development stack. Adding indexes/TTL/stream, routes and publisher resources
  requires reviewed migration/change-set approval before any deployment.
- Youth enrollment, guardian consent, safeguarding, approved consent/retention,
  verified screening/eligibility procedures and reviewer provisioning remain
  prerequisites to a live adult pilot.

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

Both Founder worktrees passed current workspace checks and tests independently.
The dashboard worktree also passed lint, production build and release-output
checks; a new guard rejects negative aggregate counts. No Founder stack was
deployed, no owner subject was configured and both worktrees remain uncommitted.
The next step is separate review/PR preparation with migration review against
the live stack; do not merge the worktrees or resolve overlapping docs blindly.

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
Their dirty source branches accept generated CloudFront URLs or the exact
development hostname above, and validate the matching distribution alias and
ACM/TLS configuration. Until those changes merge, the deployed main-branch
workflows continue to use generated URLs. Publishing itself does not change DNS.

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
  already complete. The dev hostname is active, but Cognito callback/logout
  URLs still use the generated CloudFront hostname; reconcile those before an
  authenticated pilot. Production hostnames remain a separate approval.

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
- Source now includes gated adult application persistence, 24-hour
  idempotency, group-gated review actions, optimistic version/expiry checks,
  atomic decision/outbox writes and strict aggregate mentor-event delivery with
  stream retry/DLQ and scheduled reconciliation.
- These are not deployed: the existing Community development stack predates
  its new table indexes/TTL/stream, routes, administrator group and publisher.
  Review the live-table migration/change set before any update; no bootstrap or
  publisher setup needs to be repeated.
- Add the reviewed application/consent UI and MFA administrator review UI;
  authorize reviewer membership only through an approved operator. Keep
  application intake, public enrollment and all youth participation closed.
- Run a real database concurrency/expiry rehearsal, verify SQS recovery and
  end-to-end aggregate delivery, then evaluate assignment, notification and
  operational escalation features after policy approval.

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
