# ADR 0001: Consulting domain and release boundaries

Status: Accepted for foundation implementation, 2026-11-05.

- This repository owns Consulting frontend, API, identity, CRM, project/task,
  assignment, timesheet and restricted finance data.
- Founder reporting lives in `CteNerd/roddy.tomlin.life`, not a new repository.
  It receives only reviewed aggregate events; no shared CRUD API or domain table.
- Contributors require explicit Consulting membership and project assignments.
  A Community mentor is not automatically a Consulting contributor. Contributors
  cannot access finance, other projects, or approve their own time.
- Domain writes and sanitized outbox records must commit atomically. Use stable
  event IDs, handle partial publishing failures, and recover beyond stream
  retention. Founder availability must not block source-domain operations.
- Pin authoritative schemas from the personal repository's `packages/contracts`
  to an immutable commit and file hashes. Preserve `rct.consulting` source IDs.
- One existing AWS account in `us-east-1`, separate staging/production resources
  and DynamoDB on-demand tables. Runtime/deploy/local roles are least-privilege;
  no broad bootstrap identity is copied into repository delivery.
- Third Down Technologies is a provisional display brand. Do not rename live
  resources, purchase domains, change DNS, or publish a rebrand through this PR.
- The owner approved private visibility and default-branch migration from
  `master` to `main` after checking workflow and hosting dependencies.
- PR CI is credential-free. Future merges deploy staging; production explicitly
  promotes a verified immutable release. No AWS deployment in the foundation.
- Require PR/check protections where GitHub entitlement allows; do not require
  a second reviewer while the owner is the sole maintainer.

## Legacy migration inventory

| Existing route | Disposition before replacement |
| --- | --- |
| `/` | Preserve legacy implementation; replace with approved audience/service funnel. |
| `/about` | Review claims and contact details before migrating. |
| `/services` and `/services/{consult,implement,adopt,maintenance,enhancements}` | Map lifecycle to Rethink/Create/Transform without losing approved services. |
| `/faqs` | Review commercial promises before migration. |
| `/payment` | Archive/review terms; do not adopt compounded daily late fees as approved policy. |
| Footer contract download, phone, email | Preserve unchanged until ownership and legal review. |

The CRA app remains untouched in this increment. Contract CI is a foundation
gate, not evidence that the legacy frontend is modernized or deployable.
