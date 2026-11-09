import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import { App } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { configuration } from "./config.ts";
import { ApplicationStack } from "./stack.ts";

for (const environment of ["development", "production"] as const) {
  test(`${environment} real-account assembly publishes only to its isolated release prefix using current credentials`, (t) => {
    const config = configuration(environment, "425061472162");
    const outdir = resolve(import.meta.dirname, `../.assembly-test-${environment}-${process.pid}`);
    t.after(() => rmSync(outdir, { recursive: true, force: true }));
    const app = new App({ outdir });
    const stack = new ApplicationStack(app, config, environment === "production", environment === "production");
    const assembly = app.synth();
    const manifest = readFileSync(resolve(outdir, "manifest.json"), "utf8");
    const assetsText = readFileSync(resolve(outdir, `${stack.stackName}.assets.json`), "utf8");
    const templateText = readFileSync(resolve(outdir, `${stack.stackName}.template.json`), "utf8");
    assert.doesNotMatch(manifest + assetsText + templateText,
      /hnb659fds|cdk-bootstrap|BootstrapVersion|requiresBootstrapStackVersion|assumeRole|cloudFormationExecutionRole|lookupRole/);
    const expectedBucket = environment === "development"
      ? "rct-consulting-development-assets-425061472162-us-east-1"
      : "rct-consulting-production-release-assets-425061472162-us-east-1";
    assert.equal(config.releaseAssetsBucket, expectedBucket);
    const assets = JSON.parse(assetsText) as {
      files: Record<string, { destinations: Record<string, { bucketName: string; objectKey: string; region: string }> }>;
      dockerImages: Record<string, unknown>;
    };
    assert.ok(Object.keys(assets.files).length >= 2, "Lambda assets must be present");
    assert.deepEqual(assets.dockerImages, {});
    for (const asset of Object.values(assets.files)) {
      assert.equal(Object.keys(asset.destinations).length, 1);
      for (const destination of Object.values(asset.destinations)) {
        assert.equal(destination.bucketName, expectedBucket);
        assert.match(destination.objectKey, /^release\/[a-f0-9]{64}\.(zip|json)$/);
        assert.equal(destination.region, "us-east-1");
      }
    }
    const template = Template.fromJSON(assembly.getStackByName(stack.stackName).template);
    template.hasResourceProperties("AWS::Lambda::Function", {
      Code: { S3Bucket: expectedBucket, S3Key: Match.stringLikeRegexp("^release/") },
    });
  });
}

test("production asset-only bootstrap retains a private versioned encrypted bucket without any identity or dev bootstrap", () => {
  const body = JSON.parse(readFileSync(resolve(import.meta.dirname, "../release-assets.production.template.json"), "utf8"));
  const template = Template.fromJSON(body);
  assert.deepEqual(Object.values(body.Resources).map((resource) => (resource as { Type: string }).Type).sort(),
    ["AWS::S3::Bucket", "AWS::S3::BucketPolicy"]);
  template.hasResource("AWS::S3::Bucket", {
    DeletionPolicy: "Retain", UpdateReplacePolicy: "Retain",
    Properties: Match.objectLike({
      BucketName: { "Fn::Sub": "rct-consulting-production-release-assets-${AWS::AccountId}-us-east-1" },
      BucketEncryption: { ServerSideEncryptionConfiguration: [{ ServerSideEncryptionByDefault: { SSEAlgorithm: "AES256" } }] },
      VersioningConfiguration: { Status: "Enabled" },
      OwnershipControls: { Rules: [{ ObjectOwnership: "BucketOwnerEnforced" }] },
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: true, BlockPublicPolicy: true, IgnorePublicAcls: true, RestrictPublicBuckets: true,
      },
    }),
  });

  test("documented change-set commands abort before AWS writes for wrong accounts, service roles and failed checks", (t) => {
    const root = resolve(import.meta.dirname, `../.runbook-test-${process.pid}`);
    mkdirSync(resolve(root, "bin"), { recursive: true });
    t.after(() => rmSync(root, { recursive: true, force: true }));
    for (const environment of ["development", "production"]) {
      const directory = resolve(root, `infra/cdk.out/review-${environment}`);
      mkdirSync(directory, { recursive: true });
      writeFileSync(resolve(directory, "manifest.json"), JSON.stringify({ artifacts: {
        [`rct-consulting-${environment}-foundation`]: { properties: {
          stackTemplateAssetObjectUrl: `s3://test-bucket/release/${"a".repeat(64)}.json`,
        } },
      } }));
    }
    writeFileSync(resolve(root, "bin/aws"), `#!/usr/bin/env bash
  if test "$1 $2" = "sts get-caller-identity"; then
    printf '%s\\n' "$TEST_ACCOUNT"
    exit 0
  fi
  if test "$1 $2" = "cloudformation describe-stacks"; then
    if test "\${TEST_ROLE_FAILURE:-}" = 1; then exit 1; fi
    printf '%s\\n' "$TEST_ROLE"
    exit 0
  fi
  printf '%s\\n' "$*" >> "$TEST_WRITES"
  `, { mode: 0o755 });
    const runbook = readFileSync(resolve(import.meta.dirname, "../README.md"), "utf8");
    const blocks = [...runbook.matchAll(/```sh\n([\s\S]*?)```/g)].map((match) => match[1]!);
    const bootstrap = blocks.find((block) => block.includes("--template-body file://infra/release-assets.production.template.json"));
    const application = blocks.find((block) => block.includes("DEV_TEMPLATE_URL="));
    assert.ok(bootstrap);
    assert.ok(application);
    const writes = resolve(root, "writes.log");
    for (const [script, account, role, roleFailure] of [
      [bootstrap, "111122223333", "None", ""],
      [application, "111122223333", "None", ""],
      [application, "425061472162", "arn:aws:iam::425061472162:role/prohibited-executor", ""],
      [application, "425061472162", "None", "1"],
    ]) {
      writeFileSync(writes, "");
      const result = spawnSync("bash", ["-c", script!], {
        cwd: root, encoding: "utf8", env: {
          ...process.env, PATH: `${resolve(root, "bin")}:${process.env.PATH}`,
          TEST_ACCOUNT: account!, TEST_ROLE: role!, TEST_ROLE_FAILURE: roleFailure!, TEST_WRITES: writes,
        },
      });
      assert.notEqual(result.status, 0, "Unsafe target must abort");
      assert.match(result.stderr, /STOP:/);
      assert.equal(readFileSync(writes, "utf8"), "", "No AWS mutation may follow a failed guard");
    }
  });
  template.hasResourceProperties("AWS::S3::BucketPolicy", {
    PolicyDocument: {
      Version: "2012-10-17",
      Statement: [{
        Sid: "DenyInsecureTransport", Effect: "Deny", Principal: "*", Action: "s3:*",
        Resource: [{ "Fn::GetAtt": ["ReleaseAssets", "Arn"] }, { "Fn::Sub": "${ReleaseAssets.Arn}/*" }],
        Condition: { Bool: { "aws:SecureTransport": "false" } },
      }],
    },
  });
  assert.doesNotMatch(JSON.stringify(body), /hnb659fds|cdk-bootstrap|AssumeRole|AWS::IAM::|development-assets|AdministratorAccess/);
});
