import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { createCandidate } from "./web-candidate.ts";
import { developmentCertificateArn } from "./config.ts";

test("offline promotion verifies both targets and fails before writes for tampering or unprotected dev", (t) => {
  const root = resolve(import.meta.dirname, `../.promotion-test-${process.pid}`);
  const repository = resolve(import.meta.dirname, "../..");
  mkdirSync(join(root, "bin"), { recursive: true });
  mkdirSync(join(root, "candidate/assets"), { recursive: true });
  symlinkSync(join(repository, "infra"), join(root, "infra"));
  t.after(() => rmSync(root, { recursive: true }));
  writeFileSync(join(root, "candidate/index.html"), "<html>Public brand; intake closed.</html>");
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
  process.stdout.write(url.pathname === "/leads" ? "503"
    : url.hostname.includes("execute-api") ? "401" : "404");
} else if (url.pathname === "/health") {
  process.stdout.write(JSON.stringify({ status: "ok", application: "consulting" }));
} else {
  const data = fs.readFileSync(url.pathname.startsWith("/assets/") ? "candidate" + url.pathname : "candidate/index.html");
  if (!args.includes("--output")) process.stdout.write(data);
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
    assert.doesNotMatch(calls, /--delete|delete-object|assume-role|deploy/);
    assert.equal(readFileSync(join(root, ".release/previous-index.html"), "utf8"), "previous release");
    assert.equal(JSON.parse(readFileSync(join(root, ".release/promotion.json"), "utf8")).manifestSha256, hash);
  }
  const unprotected = run("development", { OMIT_NOINDEX: "1" });
  assert.notEqual(unprotected.status, 0);
  assert.doesNotMatch(readFileSync(join(root, "aws.log"), "utf8"), /s3 sync|s3 cp|create-invalidation/);
  writeFileSync(join(root, "candidate/assets/index-hash.js"), "tampered");
  const tampered = run("production");
  assert.notEqual(tampered.status, 0);
  assert.equal(readFileSync(join(root, "aws.log"), "utf8"), "");
});
