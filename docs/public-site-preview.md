# Third Down Technologies public-site preview

The modern public frontend is `apps/web`, not the historical CRA `src` tree.
The default remains a development preview. Public publication of Third Down
Technologies / Third Down Tech is approved separately from opening intake or
access; production presentation does not assert legal clearance or quantified
outcomes. `main` is the default branch and the legacy remote `master` branch has
been retired. This source change is not an authorization to change hosting/DNS.

## Information architecture

| Route | Purpose |
| --- | --- |
| `/` | Brand framework, audience choices and service overview |
| `/small-business` | Practical foundations, ownership and workflow improvements |
| `/enterprise` | Architecture, integrations, delivery and team collaboration |
| `/work` | Status-labeled client work and a separate founder experiment |
| `/services` | Five service areas and appropriate-fit technology decisions |
| `/services/digital-foundations` | Websites, business tools and account handover |
| `/services/engineering-solutions` | Software, APIs, integrations and modernization |
| `/services/fractional-leadership` | Roadmaps, decisions, risks and advisory capacity |
| `/services/ai-automation` | Workflow evaluation, approved data, human review and fallbacks |
| `/services/cloud-cost-optimization` | Cost assessment, reliability trade-offs and verification |
| `/approach` | Rethink / Create / Transform; owner-directed software, discovery, projects and retainers |
| `/about` | Founder background and working principles, without employer-project claims |
| `/faq` | Scope, technology, commercial boundaries and readiness questions |
| `/contact` | Accurate closed-intake status and private discovery preparation |

These are native internal links, with full document navigation and browser
history, not a new router dependency. Vite supports direct requests locally.
The approach page describes three Rethink / Create / Transform stages, discovery,
fixed-scope and ongoing engagement models, and owner-directed changes. Changes
remain reviewed, tested and handed over; integrations and regulated work require
separate scoping, approved data and access, and explicit ownership.

The authenticated `/?workspace` route remains available to invited users but
has no public navigation link. It is not an enrollment flow.

## Hosted deep-link handling

The source-only infrastructure change in `infra/src/web-routing.ts` associates
a CloudFront viewer-request rewrite with the web distribution. It rewrites only
the 14 approved public paths, with optional trailing slashes, for `GET` and
`HEAD` requests while preserving query parameters. The default
`activatePublicRouteMetadata=false` mode maps approved paths to `index.html`;
only explicit `true` maps non-root pages to `route-meta/*.html`. Each generated
shell loads the same SPA bundles and carries unique title, description,
canonical, Open Graph and Twitter metadata. Unknown paths and asset requests
are left to the origin so real missing-resource errors are not hidden. Local
Vite navigation renders the frontend recovery page for an unknown path; a
hosted unknown path remains an origin missing-resource response instead of
being rewritten to the SPA.

This edge change has **not** been deployed. For migration, first deploy the
compatibility mode to grant shell publication access without routing to shells
that are not present. Publish and verify the shells with `shells_only`, then
deploy with `activatePublicRouteMetadata=true` and verify clean routes with
`active_routes`. Until the first stack update, the current host can continue to
return origin errors for deep links; after the compatibility update they map
to the shared SPA entry point. Local Vite deep links work without that
migration. Existing development hostname aliases and ACM certificate settings
are unchanged; this work does not change DNS, distribution aliases or
certificates.

## Preserved boundaries

- Public intake remains **closed in the unconfigured preview**. No live calendar,
  invented mailbox, phone, contact destination or payment flow was added.
- The `LeadForm` component and its API URL, explicit enable flag and consent
  gates remain in source and have independent tests, but `/contact` does not
  render a form. No intake configuration was enabled or supplied.
- `?admin` and OAuth callback query parameters continue to render the existing
  admin inbox. Its implementation, authorization settings and tests are unchanged.
- The `/?workspace` entry reuses
  the existing Cognito PKCE helper and configured API root; it does not add
  enrollment, account creation or another authentication flow. No project data
  is fabricated when configuration, membership, assignment or API access is
  unavailable. The API remains authoritative for role checks and versioned
  task, assignment and time-entry transitions.
- The bounded workspace supports the existing API operations: assigned project
  and task reads, manager assignment/task creation and task status transitions,
  own time-draft creation/editing/submission, rejected-time correction, and
  manager review of submitted time. Submitted and approved entries are not
  editable; assignment revocation, review reversal, and document upload are not
  implemented UI actions. Bootstrap membership/project/manager records and the
  `WorkspaceIndex` migration remain reviewed operational gates.
- Default HTML retains `noindex, nofollow` and development-preview titles.
  Production requires explicit `VITE_PUBLIC_PRESENTATION=production`, not
  Vite's normal production-build flag. It removes preview/provisional language
  and the HTML noindex guard. Optional `VITE_PUBLIC_ORIGIN` must be exactly
  `https://thirddowntech.com`; it adds static route-specific canonical and social
  metadata, never derived from the browser's potentially-dev origin. Runtime
  metadata stays synchronized for browser navigation. Dev CloudFront response
  headers keep staged production candidates noindex independently of HTML.
  No structured legal identity, social profile,
  tracking code or speculative social image was added.
- Service deliverables remain illustrative and scoped through discovery.
  `/work` contains owner-approved project descriptions with current status and
  public source-repository evidence. It includes no customer quotes, private
  screenshots, patient data, employer-project attribution, invented metrics,
  savings percentages, guarantees, pricing or new legal policies.
- No historical contract, payment page or contact recipient was migrated. The
  legacy CRA source remains untouched. Its old lifecycle maps
  conceptually to Rethink (Consult), Create (Implement), and Transform (Adopt,
  Maintain, Enhance), not to unreviewed route redirects or commercial promises.
- This frontend adds no backend routes, root dependency or lockfile changes.
  The separate source-only CloudFront rewrite is described above; it requires
  reviewed infrastructure migration and has not been deployed.

## Synthetic local UAT rehearsal

The actual `/?workspace` UI also supports an explicitly started, local-only
workflow rehearsal. It is not real authentication, Cognito, DynamoDB, or the
live API. Synthetic managers, contributors, an app administrator and an
unassigned member operate only against in-memory records in the browser; the
rehearsal does not send tokens, requests or events to AWS. It demonstrates
assigned/unassigned scope, task transitions, own time creation/correction/
submission, manager rejection/approval and visible validation/conflict errors.

It requires the `dev:uat` startup script, the explicit `uatRehearsal=1` query,
Vite development mode and a loopback hostname. The ordinary dev server and
unconfigured workspace do not enable fixtures. From the repository root:

```sh
# Optional ordinary preview, with the synthetic rehearsal disabled
npm run dev --workspace @rct/consulting-web -- --port 5176 --strictPort

# Explicit local rehearsal, only on loopback
npm run dev:uat --workspace @rct/consulting-web
```

Open `http://127.0.0.1:5186/?workspace&uatRehearsal=1`. The production build
checks that the synthetic adapter's fixture identities and records are absent.
The UAT flow does not exercise AWS integration, deployed authorization or data
persistence and cannot replace a live-environment rehearsal.

## Local validation

From the repository root:

```sh
npm run check --workspace @rct/consulting-web
./infra/node_modules/.bin/eslint --config infra/eslint.config.mjs apps/web/src
npm run build --workspace @rct/consulting-web
```

The existing infrastructure-owned ESLint configuration already covers application
TypeScript. Reusing its installed tool does not modify infrastructure or add
dependencies. `check` runs TypeScript and the full frontend test suite.

Before promoting public bytes, verify desktop/mobile content, keyboard menu,
FAQ and skip-link behavior and hosted deep links. Brand publication approval
does not establish legal clearance or intake readiness. Keep intake, enrollment
and Founderowner access closed until real UAT and separate authorization;
do not fabricate contact/consent content. See the production promotion runbook
in `infra/README.md` for exact immutable-artifact and protected-environment gates.
No generated imagery,
external font service or third-party image request is used.
