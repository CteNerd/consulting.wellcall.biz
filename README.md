# Consulting portfolio foundation

This private repository is moving toward Third Down Technologies (provisional
display brand). See the [domain and release ADR](docs/adr/0001-domain-and-release-boundaries.md).
The approved default-branch migration is `master` to `main`.

The foundation adds pinned reporting contracts, a typed React preview, API and
authorization-policy tests, and offline CDK stacks. The legacy site is preserved;
no AWS resources have been deployed by this increment.

```sh
nvm use
npm ci --workspaces --include-workspace-root=false --no-audit --no-fund
npm run check:foundation
npm run test:contracts
npm run build:web
npm run dev:web
```

[Contract documentation](packages/contracts/README.md) describes the immutable
authority revision, sanitization, correction semantics and update procedure.
CI checks modern workspaces, lint, dependency advisories, pins, preview build and
both environment synths. It does not certify the legacy frontend or deploy AWS.
Node 24 is for the new foundation, not a claim of CRA compatibility.
The new preview is not feature parity or an approved public launch. A lead
inquiry form and atomic API/outbox path are implemented but disabled by default;
the private admin inbox supports paginated lead review and version-checked
follow-up statuses (New, Contacted, Qualified and Closed). Admin access requires
the verified Cognito `ConsultingAdministrators` group and configured PKCE login.
Enabling intake still requires approved consent and retention settings,
hosted login configuration and operational notification/recovery verification.
No AWS resources have been deployed. Policy tests do not replace server-loaded assignment checks when
business CRUD endpoints are introduced. See the
[infrastructure/release runbook](infra/README.md).

A manual development web-publishing workflow is prepared for `main` after a
reviewed foundation bootstrap. Configure `AWS_ACCOUNT_ID` and
`AWS_WEB_PUBLISH_ROLE_ARN` as development environment variables; no AWS keys or
browser client secrets are needed. It publishes only the modern preview to
the stack's generated CloudFront URL and does not deploy infrastructure or
open public intake. The runbook documents activation and remaining live checks.

See the [portfolio development handoff](docs/development-handoff-2026-11-06.md)
for completed work, validation evidence, release prerequisites and the next-session plan.

The CRA dependency is patched from 4.0.1 to 4.0.3 because 4.0.1 declares only
TypeScript 3 support despite this repo already using TypeScript 4.1. The patch
allows npm to resolve the workspace without force/legacy-peer overrides. The
single lockfile is upgraded to npm's current format; this is not a CRA migration.
Scoped dependency patches and compatible ESLint 7 minimatch/semver overrides
address old peers pulled into modern linting. Moderate minimatch advisories
remain in current CDK/ESLint tooling; CI reports them and fails at high severity.

Confirmed hosts are `thirddowntech.com`, `dev.thirddowntech.com` and
`api.thirddowntech.com`. Reuse the registered Route 53 zone; brand clearance,
certificates, cutover and protected production environment approval remain gates.
Scaffolding must not automatically deploy production.

## Public contact and link previews

Approved production presentation shows the business line, 281-692-7522, in the
footer and discovery-preparation page. Intake and booking remain closed.
With the explicit production origin, the initial HTML includes Open Graph and
Twitter large-image metadata pointing to
`apps/web/public/assets/social-card-4cfaaa052494.jpg`.
This generated 1200×630 illustration is shared with CUT BLOCK and is published
by Vite with the web candidate as an immutable, content-addressed asset. When
replacing the artwork, update the filename hash and metadata together. Default previews remain noindex without public
social metadata or the business line.

## Legacy development commands (historical)

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

The page will reload if you make edits.\
You will also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode.\
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

### `npm run eject`

**Note: this is a one-way operation. Once you `eject`, you can’t go back!**

If you aren’t satisfied with the build tool and configuration choices, you can `eject` at any time. This command will remove the single build dependency from your project.

Instead, it will copy all the configuration files and the transitive dependencies (webpack, Babel, ESLint, etc) right into your project so you have full control over them. All of the commands except `eject` will still work, but they will point to the copied scripts so you can tweak them. At this point you’re on your own.

You don’t have to ever use `eject`. The curated feature set is suitable for small and middle deployments, and you shouldn’t feel obligated to use this feature. However we understand that this tool wouldn’t be useful if you couldn’t customize it when you are ready for it.

## Learn More

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).

To learn React, check out the [React documentation](https://reactjs.org/).
