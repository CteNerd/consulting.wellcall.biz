# Consulting portfolio foundation

This private repository is moving toward Third Down Technologies (provisional
display brand). See the [domain and release ADR](docs/adr/0001-domain-and-release-boundaries.md).
The approved default-branch migration is `master` to `main`.

The initial foundation adds strict, pinned reporting contracts without changing
the legacy site or deploying AWS resources.

```sh
nvm use
npm ci --workspace @rct/portfolio-contracts --include-workspace-root=false --ignore-scripts --no-audit --no-fund
npm run test:contracts
```

[Contract documentation](packages/contracts/README.md) describes the immutable
authority revision, sanitization, correction semantics and update procedure.
CI checks the new contract workspace and pinned-file integrity only. It does not
certify the legacy frontend, provision infrastructure or enable deployment.
Frontend migration, authorization tests, CDK synth and development release follow in
separate increments. Node 24 is selected for the new foundation, not a claim that
the old CRA toolchain supports it.

The CRA dependency is patched from 4.0.1 to 4.0.3 because 4.0.1 declares only
TypeScript 3 support despite this repo already using TypeScript 4.1. The patch
allows npm to resolve the workspace without force/legacy-peer overrides. The
single lockfile is upgraded to npm's current format; this is not a CRA migration.

Confirmed hosts are `thirddowntech.com`, `dev.thirddowntech.com` and
`api.thirddowntech.com`. Reuse the registered Route 53 zone; brand clearance,
certificates, cutover and protected production environment approval remain gates.
Scaffolding must not automatically deploy production.

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
