# Third Down Technologies public-site preview

The modern public frontend is `apps/web`, not the historical CRA `src` tree.
This is a non-production content and design implementation. Third Down
Technologies / Third Down Tech remains a provisional display brand. It is not
a legal identity, launch approval or authorization to change hosting or DNS.
The current portfolio implementation plan supersedes the older `master` and
`staging` assumptions; this work changes neither branches nor environments.

## Information architecture

| Route | Purpose |
| --- | --- |
| `/` | Brand framework, audience choices and service overview |
| `/small-business` | Practical foundations, ownership and workflow improvements |
| `/enterprise` | Architecture, integrations, delivery and team collaboration |
| `/services` | Five service areas and appropriate-fit technology decisions |
| `/services/digital-foundations` | Websites, business tools and account handover |
| `/services/engineering-solutions` | Software, APIs, integrations and modernization |
| `/services/fractional-leadership` | Roadmaps, decisions, risks and advisory capacity |
| `/services/ai-automation` | Workflow evaluation, approved data, human review and fallbacks |
| `/services/cloud-cost-optimization` | Cost assessment, reliability trade-offs and verification |
| `/approach` | Rethink / Create / Transform; discovery, projects and retainers |
| `/about` | Brand philosophy and working principles, without unverified biography |
| `/faq` | Scope, technology, commercial boundaries and readiness questions |
| `/contact` | Discovery preparation and the existing gated lead UI |

These are native internal links, with full document navigation and browser
history, not a new router dependency. Vite supports direct requests locally.

The footer's **Team workspace** link opens `/?workspace`, a root query entry
for authenticated internal use. It is not a new public path or enrollment flow.

## Hosted deep-link handling

The source-only infrastructure change in `infra/src/web-routing.ts` associates
a CloudFront viewer-request rewrite with the web distribution. It rewrites only
the 13 approved public paths, with optional trailing slashes, for `GET` and
`HEAD` requests to `index.html` while preserving query parameters. Unknown
paths and asset requests are left to the origin so real missing-resource errors
are not hidden. Local Vite navigation renders the frontend recovery page for an
unknown path; a hosted unknown path remains an origin missing-resource response
instead of being rewritten to the SPA.

This edge change has **not** been deployed. A reviewed infrastructure migration
is required before hosted deep-link navigation or refresh works; publishing web
assets alone does not install the rewrite. Local Vite deep links work without
that migration. Existing development hostname aliases and ACM certificate
settings are unchanged; this work does not change DNS, distribution aliases or
certificates.

## Preserved boundaries

- Public intake remains **closed in the unconfigured preview**. No live calendar,
  invented mailbox, phone, contact destination or payment flow was added.
- `LeadForm` and its existing API URL, explicit enable flag and approved consent
  gates are unchanged. The form now lives on `/contact`; unit tests cover both
  its closed state and existing enabled submission behavior. This work does not
  enable intake or supply production settings.
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
  own time-draft creation/submission, and manager review of submitted time.
  Drafts cannot be edited or deleted; assignment revocation, time correction or
  review reversal, and document upload are not implemented API capabilities and
  are not presented as UI actions. Bootstrap membership/project/manager records
  and the `WorkspaceIndex` migration remain reviewed operational gates.
- The HTML `noindex, nofollow` guard remains. Titles explicitly say development
  preview. No canonical domain, structured legal identity, social profile,
  tracking code or speculative social image was added.
- Service deliverables are illustrative and scoped through discovery. There
  are no customer claims, testimonials, savings percentages, credentials,
  guarantees, pricing, payment terms or new legal policies.
- No historical contract, payment page, contact recipient or portfolio claim
  was migrated. The legacy CRA source remains untouched. Its old lifecycle maps
  conceptually to Rethink (Consult), Create (Implement), and Transform (Adopt,
  Maintain, Enhance), not to unreviewed route redirects or commercial promises.
- This frontend adds no backend routes, root dependency or lockfile changes.
  The separate source-only CloudFront rewrite is described above; it requires
  reviewed infrastructure migration and has not been deployed.

## Local validation

From the repository root:

```sh
npm run check --workspace @rct/consulting-web
./infra/node_modules/.bin/eslint --config infra/eslint.config.mjs apps/web/src
npm run build --workspace @rct/consulting-web
npm run dev --workspace @rct/consulting-web -- --port 5174 --strictPort
```

The existing infrastructure-owned ESLint configuration already covers application
TypeScript. Reusing its installed tool does not modify infrastructure or add
dependencies. `check` runs TypeScript and the full frontend test suite.

Before any public release, obtain human desktop/mobile design and content
approval; verify keyboard menu, FAQ and skip-link behavior; confirm brand/legal
clearance, approved contact and consent content, intake readiness and hosted
deep-link handling. This preview is not release approval. No generated imagery,
external font service or third-party image request is used.
