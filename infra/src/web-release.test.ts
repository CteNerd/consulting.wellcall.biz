import assert from "node:assert/strict";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { parsePreviewStack, validateReleaseEnvironment, verifyPreviewBucket, verifyPreviewDistribution, verifyPreviewHealth } from "./web-release.ts";

const account = "111122223333";
const roleArn = `arn:aws:iam::${account}:role/rct/consulting/development/rct-consulting-development-web-publish`;
const env = {
  GITHUB_REPOSITORY: "CteNerd/consulting.wellcall.biz", GITHUB_REF: "refs/heads/main",
  GITHUB_EVENT_NAME: "workflow_dispatch", AWS_ACCOUNT_ID: account, AWS_WEB_PUBLISH_ROLE_ARN: roleArn,
};

function stackMetadata(overrides: Record<string, string> = {}) {
  return { Stacks: [{
    StackName: "rct-consulting-development-foundation",
    StackId: `arn:aws:cloudformation:us-east-1:${account}:stack/rct-consulting-development-foundation/test`,
    StackStatus: "CREATE_COMPLETE",
    Parameters: [{ ParameterKey: "LeadIntakeEnabled", ParameterValue: "false" }],
    Outputs: Object.entries({
      WebBucket: "consulting-development-web-test", DistributionId: "E123456789TEST",
      WebUrl: "https://previewtest.cloudfront.net", ApiUrl: "https://apitest.execute-api.us-east-1.amazonaws.com",
      AuthUrl: `https://rct-consulting-development-${account}.auth.us-east-1.amazoncognito.com`,
      UserPoolClientId: "publicclient123", UserPoolId: "us-east-1_Abc123", WebPublishRoleArn: roleArn,
      ...overrides,
    }).map(([OutputKey, OutputValue]) => ({ OutputKey, OutputValue })),
  }] };
}

test("publishing rejects missing variables, other branches, automatic events and production roles", () => {
  for (const override of [
    { AWS_ACCOUNT_ID: "" }, { AWS_ACCOUNT_ID: "123456789012" },
    { GITHUB_REF: "refs/heads/feature" }, { GITHUB_EVENT_NAME: "push" },
    { GITHUB_REPOSITORY: "other/repo" }, { AWS_WEB_PUBLISH_ROLE_ARN: roleArn.replaceAll("development", "production") },
  ]) assert.throws(() => validateReleaseEnvironment({ ...env, ...override }));
});

test("explicit production release is confined to the real account, production role and approved origin", () => {
  const productionEnv = {
    ...env, RELEASE_ENVIRONMENT: "production", AWS_ACCOUNT_ID: "425061472162",
    AWS_WEB_PUBLISH_ROLE_ARN: "arn:aws:iam::425061472162:role/rct/consulting/production/rct-consulting-production-web-publish",
  };
  const metadata = JSON.parse(JSON.stringify(stackMetadata({ WebUrl: "https://thirddowntech.com" }))
    .replaceAll(account, "425061472162").replaceAll("development", "production")) as unknown;
  assert.equal(parsePreviewStack(metadata, productionEnv).webUrl, "https://thirddowntech.com");
  for (const override of [
    { RELEASE_ENVIRONMENT: "staging" }, { AWS_ACCOUNT_ID: account },
    { AWS_WEB_PUBLISH_ROLE_ARN: roleArn }, { GITHUB_REF: "refs/heads/feature" },
  ]) assert.throws(() => validateReleaseEnvironment({ ...productionEnv, ...override }));
  assert.throws(() => parsePreviewStack(stackMetadata(), productionEnv));
  assert.throws(() => verifyPreviewDistribution({}, {
    bucket: "test", distributionId: "E123456789TEST", webUrl: "https://dev.thirddowntech.com",
  }, productionEnv), /approved custom origin/);
});

test("preview metadata fails closed on unsafe destinations, role drift and open intake", () => {
  assert.equal(parsePreviewStack(stackMetadata(), env).webUrl, "https://previewtest.cloudfront.net");
  assert.equal(parsePreviewStack(stackMetadata({ WebUrl: "https://dev.thirddowntech.com" }), env).webUrl,
    "https://dev.thirddowntech.com");
  const unsafeOutputs: Array<Record<string, string>> = [
    { WebUrl: "https://production.example" }, { WebUrl: "https://thirddowntech.com" },
    { WebBucket: "bucket\nOTHER=value" },
    { ApiUrl: "http://api.example" }, { AuthUrl: "https://unrelated.example" },
    { WebPublishRoleArn: `${roleArn}-other` },
  ];
  for (const override of unsafeOutputs) assert.throws(() => parsePreviewStack(stackMetadata(override), env));
  const open = stackMetadata();
  open.Stacks[0]!.Parameters[0]!.ParameterValue = "true";
  assert.throws(() => parsePreviewStack(open, env), /intake.*disabled/);
  const changing = stackMetadata();
  changing.Stacks[0]!.StackStatus = "UPDATE_IN_PROGRESS";
  assert.throws(() => parsePreviewStack(changing, env), /not ready/);
  const duplicate = stackMetadata();
  duplicate.Stacks[0]!.Outputs.push({ OutputKey: "WebUrl", OutputValue: "https://previewtest.cloudfront.net" });
  assert.throws(() => parsePreviewStack(duplicate, env), /duplicate/);
});

test("distribution verification rejects a different origin or disabled distribution and verifies API identity", () => {
  const release = parsePreviewStack(stackMetadata(), env);
  const distribution = { Distribution: {
    Id: release.distributionId, DomainName: "previewtest.cloudfront.net", Status: "Deployed",
    DistributionConfig: { Enabled: true, Origins: { Items: [{
      DomainName: `${release.bucket}.s3.us-east-1.amazonaws.com`, OriginAccessControlId: "OAC-test",
    }] } },
  } };
  verifyPreviewDistribution(distribution, release);
  const customRelease = parsePreviewStack(stackMetadata({ WebUrl: "https://dev.thirddowntech.com" }), env);
  const customDistribution = { Distribution: {
    Id: customRelease.distributionId, DomainName: "previewtest.cloudfront.net", Status: "Deployed",
    DistributionConfig: {
      Enabled: true,
      Aliases: { Quantity: 1, Items: ["dev.thirddowntech.com"] },
      ViewerCertificate: {
        ACMCertificateArn: `arn:aws:acm:us-east-1:${account}:certificate/12345678-1234-4234-8234-123456789abc`,
        SSLSupportMethod: "sni-only",
        MinimumProtocolVersion: "TLSv1.2_2021",
      },
      Origins: { Items: [{
        DomainName: `${customRelease.bucket}.s3.us-east-1.amazonaws.com`, OriginAccessControlId: "OAC-test",
      }] },
    },
  } };
  verifyPreviewDistribution(customDistribution, customRelease);
  customDistribution.Distribution.DistributionConfig.Aliases.Items[0] = "thirddowntech.com";
  assert.throws(() => verifyPreviewDistribution(customDistribution, customRelease), /Custom preview hostname/);
  customDistribution.Distribution.DistributionConfig.Aliases.Items[0] = "dev.thirddowntech.com";
  customDistribution.Distribution.DistributionConfig.ViewerCertificate.MinimumProtocolVersion = "TLSv1.2_2019";
  assert.throws(() => verifyPreviewDistribution(customDistribution, customRelease), /Custom preview hostname/);
  distribution.Distribution.DistributionConfig.Origins.Items[0]!.DomainName = "unrelated.s3.us-east-1.amazonaws.com";
  assert.throws(() => verifyPreviewDistribution(distribution, release), /private S3 bucket/);
  distribution.Distribution.DistributionConfig.Enabled = false;
  assert.throws(() => verifyPreviewDistribution(distribution, release));
  verifyPreviewHealth({ status: "ok", application: "consulting" });
  assert.throws(() => verifyPreviewHealth({ status: "ok", application: "dotcom" }));
});

test("bucket verification requires every public-access block and an explicitly non-public policy", () => {
  const config = {
    BlockPublicAcls: true, BlockPublicPolicy: true, IgnorePublicAcls: true, RestrictPublicBuckets: true,
  };
  const policy = { PolicyStatus: { IsPublic: false } };
  verifyPreviewBucket({ PublicAccessBlockConfiguration: config }, policy);
  for (const key of Object.keys(config)) {
    assert.throws(() => verifyPreviewBucket({ PublicAccessBlockConfiguration: { ...config, [key]: false } }, policy),
      /public-access blocks/);
  }
  assert.throws(() => verifyPreviewBucket({}, policy), /public-access blocks/);
  for (const unsafePolicy of [undefined, {}, { PolicyStatus: {} }, { PolicyStatus: { IsPublic: true } },
    { PolicyStatus: { IsPublic: "false" } }]) {
    assert.throws(() => verifyPreviewBucket({ PublicAccessBlockConfiguration: config }, unsafePolicy), /non-public/);
  }
});

test("release CLI emits only validated build inputs and exits unsuccessfully when configuration is absent", (t) => {
  const directory = join(import.meta.dirname, `../.release-test-${process.pid}`);
  mkdirSync(directory);
  t.after(() => rmSync(directory, { recursive: true }));
  const metadataPath = join(directory, "stack.json");
  const environmentPath = join(directory, "github-env");
  writeFileSync(metadataPath, JSON.stringify(stackMetadata()));
  const script = fileURLToPath(new URL("./check-web-release.ts", import.meta.url));
  const success = spawnSync(process.execPath, [script, "stack", metadataPath], {
    env: { ...process.env, ...env, GITHUB_ENV: environmentPath }, encoding: "utf8",
  });
  assert.equal(success.status, 0, success.stderr);
  const output = readFileSync(environmentPath, "utf8");
  assert.match(output, /PREVIEW_API_URL=https:\/\/apitest\.execute-api\.us-east-1\.amazonaws\.com\n/);
  assert.match(output, /PREVIEW_CLIENT_ID=publicclient123\n/);
  assert.equal(output.trim().split("\n").length, 7);
  const accessBlockPath = join(directory, "access-block.json");
  const policyPath = join(directory, "policy-status.json");
  writeFileSync(accessBlockPath, JSON.stringify({ PublicAccessBlockConfiguration: {
    BlockPublicAcls: true, BlockPublicPolicy: true, IgnorePublicAcls: true, RestrictPublicBuckets: true,
  } }));
  writeFileSync(policyPath, JSON.stringify({ PolicyStatus: { IsPublic: false } }));
  const privateBucket = spawnSync(process.execPath, [script, "bucket", accessBlockPath, policyPath], {
    env: { ...process.env, ...env }, encoding: "utf8",
  });
  assert.equal(privateBucket.status, 0, privateBucket.stderr);
  writeFileSync(policyPath, JSON.stringify({ PolicyStatus: { IsPublic: true } }));
  const publicBucket = spawnSync(process.execPath, [script, "bucket", accessBlockPath, policyPath], {
    env: { ...process.env, ...env }, encoding: "utf8",
  });
  assert.notEqual(publicBucket.status, 0);
  assert.match(publicBucket.stderr, /non-public/);
  const missing = spawnSync(process.execPath, [script, "environment"], {
    env: { ...process.env, ...env, AWS_ACCOUNT_ID: "" }, encoding: "utf8",
  });
  assert.notEqual(missing.status, 0);
  assert.match(missing.stderr, /AWS_ACCOUNT_ID/);
});
