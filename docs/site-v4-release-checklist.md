# Website v4 release evidence

This is a source-only website change. It does not publish assets, change DNS,
enable lead intake, modify AWS resources, or authorize a production deployment.
The new `/work` route also requires the reviewed CloudFront rewrite in
[`infra/src/web-routing.ts`](../infra/src/web-routing.ts); that rewrite is not
deployed by this change. The production artifact includes generated route HTML
with unique crawler-readable metadata; publish those shells before deploying
the route rewrite that serves them.

## Portfolio publication record

The site owner confirmed publication approval on 2026-11-11. The cards use the
approved names, relationship/status categories and factual scope below. No
client images, logos, quotes, patient information or quantitative outcomes were
provided or used.

| Project | Published category and scope | Explicit limits |
| --- | --- | --- |
| R3 Counseling | Client work; owner-confirmed in-use website, owner-directed changes | No patient, treatment, or compliance claims |
| Sugar Society SC | Client work; owner-confirmed in-use platform; event-based pre-sale work | Custom ordering remains future scope; no production payment, order-volume, revenue, or savings claim |
| The Lab Performance & Strength | Client work; in progress with staged static-site work | No claim of completed work, live booking, payment, or backend |
| Candy Map / Neighborhood Celebrations | Separate founder experiment | No adoption, residency-verification, or property-ownership claim |
| Founder profile | Owner-approved background and first-person company context | No employer names, employer-project attribution, photo, or resume link |

Public repository links are used as evidence links; no other repository was
modified. Project records are typed in
[`apps/web/src/project-content.ts`](../apps/web/src/project-content.ts), and
only records marked `ownerApproval: "approved"` are rendered.

## Contact and lead-intake audit

The `/contact` route now states that public inquiries and discovery booking are
closed. It provides preparation guidance only; it has no form, telephone link,
mailbox, calendar, or checkout.

The existing lead implementation was reviewed but not activated:

- The web form component requires the explicit
  `VITE_LEAD_INTAKE_ENABLED` flag, approved consent copy and version, and an API
  URL. The production promotion workflow sets intake to `false` and leaves the
  consent/API settings empty.
- The API validates bounded fields, the consent checkbox/version and a
  honeypot. It uses idempotency and an atomic lead/outbox transaction; the
  reporting event contains aggregate counts rather than lead details.
- Lead records have a configured expiry value and the admin inbox is
  authenticated. DynamoDB TTL expiry is asynchronous; source tests do not prove
  physical deletion, backups, or a complete retention process.
- The runbook reports no owner notification, owner assignment, CAPTCHA/WAF
  intake control, or live event-delivery verification. API throttling and the
  honeypot are useful controls, not evidence that abuse handling is complete.
- No deployed environment settings, stored inquiries, notification workflow or
  live operational behavior were inspected. No live data was accessed.

Before any future intake activation, an owner must separately approve and
verify:

- [ ] Purpose, privacy notice, consent wording/version, retention period and
  response expectations.
- [ ] Expiry configuration, physical deletion evidence, backup/recovery
  boundaries and a process for deletion requests.
- [ ] Named lead owner, secure notification/fallback, escalation and inbox
  access review.
- [ ] Abuse controls appropriate to expected traffic, including any needed
  CAPTCHA/WAF policy, without treating rate limiting as the only defense.
- [ ] End-to-end staging tests for consent, duplicate submissions, storage,
  expiry, admin access, notifications, event delivery/retry and failure
  recovery.
- [ ] A separate explicit owner decision to configure and enable production
  intake after UAT. This PR does not provide that authorization.

## Route change summary

| Route | Change |
| --- | --- |
| `/` | Adds status-labeled selected work ahead of the decision framework; removes hypothetical scenarios |
| `/work` | Adds an evidence-linked portfolio and keeps the founder experiment separate from client work |
| `/small-business` | Focuses on customer discovery, repeated administration and affordable tool choices; includes R3 proof |
| `/enterprise` | Focuses on release risk, architecture/integration ownership and operating cost; separates leadership, architecture and delivery |
| `/services` | Becomes a compact five-capability directory; detailed service pages and their fit/deliverable/decision content remain |
| `/approach` | Condenses the three stages, engagement models and owner-directed change boundaries |
| `/about` | Adds the owner-approved first-person founder context without employer-project claims |
| `/contact` | Shows current closed status and preparation guidance without collecting information |

The repeated “Start with the problem, not the platform” block was removed from
12 route instances. Eight duplicated audience-page service cards and two
illustrative homepage scenario cards were removed. The hosted route allowlist
now includes `/work`; approved routes map to their generated metadata shells,
while unknown paths and assets retain origin error behavior. The publisher
verifies each shell byte-for-byte and reports whether the CloudFront mapping is
active, so the staged artifact can be published before the infrastructure
rewrite is switched.

## Visual review

Full-page before/after screenshots use the production site as the baseline. The
new `/work` path returned HTTP 403 before this change, so its before image records
that unavailable-route response.

| Route | Before 390 px | Before 1280 px | After 390 px | After 1280 px |
| --- | --- | --- | --- | --- |
| Home | [390](./site-v4-screenshots/before-home-390.png) | [1280](./site-v4-screenshots/before-home-1280.png) | [390](./site-v4-screenshots/after-home-390.png) | [1280](./site-v4-screenshots/after-home-1280.png) |
| Small business | [390](./site-v4-screenshots/before-small-business-390.png) | [1280](./site-v4-screenshots/before-small-business-1280.png) | [390](./site-v4-screenshots/after-small-business-390.png) | [1280](./site-v4-screenshots/after-small-business-1280.png) |
| Enterprise | [390](./site-v4-screenshots/before-enterprise-390.png) | [1280](./site-v4-screenshots/before-enterprise-1280.png) | [390](./site-v4-screenshots/after-enterprise-390.png) | [1280](./site-v4-screenshots/after-enterprise-1280.png) |
| Services | [390](./site-v4-screenshots/before-services-390.png) | [1280](./site-v4-screenshots/before-services-1280.png) | [390](./site-v4-screenshots/after-services-390.png) | [1280](./site-v4-screenshots/after-services-1280.png) |
| Approach | [390](./site-v4-screenshots/before-approach-390.png) | [1280](./site-v4-screenshots/before-approach-1280.png) | [390](./site-v4-screenshots/after-approach-390.png) | [1280](./site-v4-screenshots/after-approach-1280.png) |
| About | [390](./site-v4-screenshots/before-about-390.png) | [1280](./site-v4-screenshots/before-about-1280.png) | [390](./site-v4-screenshots/after-about-390.png) | [1280](./site-v4-screenshots/after-about-1280.png) |
| Contact | [390](./site-v4-screenshots/before-contact-390.png) | [1280](./site-v4-screenshots/before-contact-1280.png) | [390](./site-v4-screenshots/after-contact-390.png) | [1280](./site-v4-screenshots/after-contact-1280.png) |
| Work | [390 / 403](./site-v4-screenshots/before-work-390.png) | [1280 / 403](./site-v4-screenshots/before-work-1280.png) | [390](./site-v4-screenshots/after-work-390.png) | [1280](./site-v4-screenshots/after-work-1280.png) |

Responsive checks covered all eight pages at 375, 390, 430, 768 and 1280 px:
there was no horizontal overflow, each page had one H1, and no visible link,
button or disclosure summary had a target below 44 px. Direct page loads and
mobile-menu open/close behavior were checked. The menu disclosure test also
asserts its `aria-expanded` state. Browser keyboard input was not reliably
captured by the available automation, so a manual keyboard-focus walk-through
remains outstanding before production release.

## Validation

- [x] `npm run check:foundation` (all workspace type checks and tests passed)
- [x] `VITE_PUBLIC_PRESENTATION=production npm run build:web` (route shells generated and verified)
- [x] `npm run test:contracts` (contract tests and pinned inventory passed)
- [x] Web tests (76 passed) and infrastructure checks (22 passed)
- [x] `npm run lint --workspace @rct/consulting-infra`
- [x] Local direct-load and responsive browser checks; no production deployment or intake activation
- [ ] Manual keyboard-focus walk-through before production release
