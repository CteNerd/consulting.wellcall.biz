import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { createCandidate } from "./web-candidate.ts";
import { developmentCertificateArn } from "./config.ts";
import { publicPaths, publicRouteHtmlPath } from "./web-routing.ts";

test("offline promotion verifies both targets and fails before writes for tampering or unprotected dev", (t) => {
  const root = resolve(import.meta.dirname, `../.promotion-test-${process.pid}`);
  const repository = resolve(import.meta.dirname, "../..");
  mkdirSync(join(root, "bin"), { recursive: true });
  mkdirSync(join(root, "candidate/assets"), { recursive: true });
  mkdirSync(join(root, "candidate/route-meta"), { recursive: true });
  symlinkSync(join(repository, "infra"), join(root, "infra"));
  t.after(() => rmSync(root, { recursive: true }));
  writeFileSync(join(root, "candidate/index.html"), "<html>Public brand; intake closed.</html>");
  for (const path of publicPaths.filter((item) => item !== "/")) {
    writeFileSync(join(root, "candidate", publicRouteHtmlPath(path)), `<html>${path}</html>`);
  }
  writeFileSync(join(root, "candidate/assets/index-hash.js"), "closed");
  const sourceSha = "a".repeat(40);
  const hash = createCandidate(join(root, "candidate"), sourceSha, "123");
  writeFileSync(join(root, "bin/aws"), `#!/usr/bin/env node
import fs from "node:fs";
const args = process.argv.slice(2);
fs.appendFileSync("aws.log", args.join(" ") + "\\n");
const env = process.env.RELEASE_ENVIRONMENT;
const prefix = "rct-consulting-" + env;
const account = "425061472162";
const webHost = env === "production" ? "thirddowntech.com" : "dev.thirddowntech.com";
const outputs = {
  WebBucket: "consulting-test-bucket", DistributionId: "E123456789TEST",
  WebUrl: "https://" + webHost, ApiUrl: "https://apitest.execute-api.us-east-1.amazonaws.com",
  AuthUrl: "https://" + prefix + "-" + account + ".auth.us-east-1.amazoncognito.com",
  UserPoolClientId: "client123", UserPoolId: "us-east-1_Test",
  WebPublishRoleArn: "arn:aws:iam::" + account + ":role/rct/consulting/" + env + "/" + prefix + "-web-publish",
};
let value = {};
if (args[1] === "describe-stacks") value = { Stacks: [{
  StackName: prefix + "-foundation",
  StackId: "arn:aws:cloudformation:us-east-1:" + account + ":stack/" + prefix + "-foundation/test",
  StackStatus: "UPDATE_COMPLETE", Parameters: [{ ParameterKey: "LeadIntakeEnabled", ParameterValue: "false" }],
  Outputs: Object.entries(outputs).map(([OutputKey, OutputValue]) => ({ OutputKey, OutputValue })),
}] };
if (args[1] === "get-public-access-block") value = { PublicAccessBlockConfiguration: {
  BlockPublicAcls: true, BlockPublicPolicy: true, IgnorePublicAcls: true, RestrictPublicBuckets: true,
} };
if (args[1] === "get-bucket-policy-status") value = { PolicyStatus: { IsPublic: false } };
if (args[1] === "get-distribution") value = { Distribution: {
  Id: outputs.DistributionId, DomainName: "test.cloudfront.net", Status: "Deployed", DistributionConfig: {
    Enabled: true, Aliases: { Quantity: 1, Items: [webHost] }, ViewerCertificate: {
      ACMCertificateArn: ${JSON.stringify(developmentCertificateArn)},
      SSLSupportMethod: "sni-only", MinimumProtocolVersion: "TLSv1.2_2021",
    }, Origins: { Items: [{ DomainName: outputs.WebBucket + ".s3.us-east-1.amazonaws.com", OriginAccessControlId: "OAC-test" }] },
  },
} };
if (args[1] === "list-objects-v2") { console.log("index.html"); process.exit(); }
if (args[1] === "cp" && args[2].startsWith("s3://")) fs.writeFileSync(args[3], "previous release");
if (args[1] === "create-invalidation") { console.log("I123TEST"); process.exit(); }
if (args[1] === "wait" && process.env.FAIL_INVALIDATION_WAIT) process.exit(1);
console.log(JSON.stringify(value));
`, { mode: 0o755 });
  writeFileSync(join(root, "bin/curl"), `#!/usr/bin/env node
import fs from "node:fs";
const args = process.argv.slice(2);
const url = new URL(args[args.length - 1]);
const headers = args.indexOf("-D");
if (headers !== -1) fs.writeFileSync(args[headers + 1],
  process.env.RELEASE_ENVIRONMENT === "development" && !process.env.OMIT_NOINDEX
    ? "x-robots-tag: noindex, nofollow\\n" : "content-type: text/html\\n");
if (args.includes("--write-out")) {
  let status = "404";
  let routeFile;
  if (url.hostname.includes("execute-api")) status = url.pathname === "/leads" ? "503" : "401";
  else if (process.env.ROUTE_METADATA_INACTIVE && url.pathname === "/work") status = "403";
  else {
    const routePath = url.pathname.replace(/\\/$/, "") || "/";
    const approvedPaths = new Set(${JSON.stringify(publicPaths)});
    routeFile = routePath === "/" ? "index.html"
      : routePath.startsWith("/assets/") || routePath.startsWith("/route-meta/")
        ? routePath.slice(1)
        : process.env.ROUTE_METADATA_INACTIVE && approvedPaths.has(routePath) ? "index.html"
          : "route-meta/" + routePath.slice(1).replace(/\\//g, "--") + ".html";
    if (fs.existsSync("candidate/" + routeFile)) status = "200";
  }
  const output = args.indexOf("--output");
  if (status === "200" && output !== -1 && args[output + 1] !== "/dev/null") {
    const data = fs.readFileSync("candidate/" + routeFile);
    fs.writeFileSync(args[output + 1], process.env.CORRUPT_PUBLISHED ? "wrong bytes" : data);
  }
  process.stdout.write(status);
} else if (url.pathname === "/health") {
  process.stdout.write(JSON.stringify({ status: "ok", application: "consulting" }));
} else {
  const routePath = url.pathname.replace(/\\/$/, "") || "/";
  const routeFile = routePath === "/" ? "index.html"
    : routePath.startsWith("/assets/") || routePath.startsWith("/route-meta/")
      ? routePath.slice(1)
      : "route-meta/" + routePath.slice(1).replace(/\\//g, "--") + ".html";
  const data = fs.readFileSync("candidate/" + routeFile);
  if (!args.includes("--output")) process.stdout.write(process.env.CORRUPT_PUBLISHED ? "wrong bytes" : data);
}
`, { mode: 0o755 });

  function run(environment: string, extra: NodeJS.ProcessEnv = {}) {
    rmSync(join(root, ".release"), { recursive: true, force: true });
    writeFileSync(join(root, "aws.log"), "");
    return spawnSync("bash", [join(repository, ".github/scripts/promote-web.sh")], {
      cwd: root, encoding: "utf8", env: {
        ...process.env, PATH: `${join(root, "bin")}:${process.env.PATH}`,
        GITHUB_REPOSITORY: "CteNerd/consulting.wellcall.biz", GITHUB_REF: "refs/heads/main",
        GITHUB_EVENT_NAME: "workflow_dispatch", GITHUB_SHA: sourceSha, GITHUB_RUN_ID: "123", GITHUB_RUN_ATTEMPT: "1",
        GITHUB_STEP_SUMMARY: join(root, "summary"), AWS_ACCOUNT_ID: "425061472162",
        AWS_WEB_PUBLISH_ROLE_ARN: `arn:aws:iam::425061472162:role/rct/consulting/${environment}/rct-consulting-${environment}-web-publish`,
        RELEASE_ENVIRONMENT: environment, CANDIDATE_MANIFEST_SHA256: hash, ...extra,
      },
    });
  }
  for (const environment of ["development", "production"]) {
    const result = run(environment);
    assert.equal(result.status, 0, result.stderr);
    const calls = readFileSync(join(root, "aws.log"), "utf8");
    assert.match(calls, /s3 sync candidate/);
    assert.match(calls, /s3 cp candidate\/index.html/);
    assert.match(calls, /s3 cp candidate\/route-meta\/work\.html/);
    assert.match(calls, /s3 sync s3:\/\/consulting-test-bucket\/route-meta\//);
    assert.doesNotMatch(calls, /--delete|delete-object|assume-role|deploy/);
    assert.equal(readFileSync(join(root, ".release/previous-index.html"), "utf8"), "previous release");
    assert.equal(JSON.parse(readFileSync(join(root, ".release/promotion.json"), "utf8")).manifestSha256, hash);
  }
  const staged = run("production", { ROUTE_METADATA_INACTIVE: "1" });
  assert.equal(staged.status, 0, staged.stderr);
  assert.match(readFileSync(join(root, "summary"), "utf8"), /shells staged and verified/);
  for (const extra of [{ FAIL_INVALIDATION_WAIT: "1" }, { CORRUPT_PUBLISHED: "1" }]) {
    const failed = run("production", extra);
    assert.notEqual(failed.status, 0);
    const provenance = JSON.parse(readFileSync(join(root, ".release/promotion.json"), "utf8"));
    assert.equal(provenance.sourceSha, sourceSha);
    assert.equal(provenance.manifestSha256, hash);
    assert.equal(provenance.distributionId, "E123456789TEST");
    assert.equal(provenance.invalidationId, "I123TEST");
    assert.equal(provenance.state, "failed");
    assert.notEqual(provenance.exitStatus, 0);
    assert.equal(readFileSync(join(root, ".release/previous-index.html"), "utf8"), "previous release");
  }
  const unprotected = run("development", { OMIT_NOINDEX: "1" });
  assert.notEqual(unprotected.status, 0);
  assert.doesNotMatch(readFileSync(join(root, "aws.log"), "utf8"), /s3 sync|s3 cp|create-invalidation/);
  writeFileSync(join(root, "candidate/assets/index-hash.js"), "tampered");
  const tampered = run("production");
  assert.notEqual(tampered.status, 0);
  assert.equal(readFileSync(join(root, "aws.log"), "utf8"), "");
});
