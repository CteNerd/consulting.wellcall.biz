const repository = "CteNerd/consulting.wellcall.biz";
import { developmentCertificateArn } from "./config.ts";

export function releaseTarget(env: NodeJS.ProcessEnv) {
  const environment = env.RELEASE_ENVIRONMENT ?? "development";
  if (environment !== "development" && environment !== "production") throw new Error("Invalid release target");
  return {
    environment,
    prefix: `rct-consulting-${environment}`,
    rolePath: `/rct/consulting/${environment}/`,
    customWebHost: environment === "production" ? "thirddowntech.com" : "dev.thirddowntech.com",
  };
}

export type PreviewRelease = {
  bucket: string;
  distributionId: string;
  webUrl: string;
  apiUrl: string;
  authUrl: string;
  clientId: string;
  userPoolId: string;
};

export function validateReleaseEnvironment(env: NodeJS.ProcessEnv): { account: string; roleArn: string } {
  const { environment, prefix, rolePath } = releaseTarget(env);
  if (env.GITHUB_REPOSITORY !== repository || env.GITHUB_REF !== "refs/heads/main"
    || env.GITHUB_EVENT_NAME !== "workflow_dispatch") {
    throw new Error("Publishing requires a manual run on this repository's main branch");
  }
  const account = env.AWS_ACCOUNT_ID;
  if (!account || !/^\d{12}$/.test(account) || account === "123456789012"
    || (environment === "production" && account !== "425061472162")) {
    throw new Error("Set AWS_ACCOUNT_ID to the verified target account (production: 425061472162)");
  }
  const roleArn = `arn:aws:iam::${account}:role${rolePath}${prefix}-web-publish`;
  if (env.AWS_WEB_PUBLISH_ROLE_ARN !== roleArn) {
    throw new Error("Set AWS_WEB_PUBLISH_ROLE_ARN to this target stack's WebPublishRoleArn output");
  }
  return { account, roleArn };
}

export function parsePreviewStack(value: unknown, env: NodeJS.ProcessEnv): PreviewRelease {
  const { account, roleArn } = validateReleaseEnvironment(env);
  const { prefix, environment } = releaseTarget(env);
  if (!isRecord(value) || !Array.isArray(value.Stacks) || value.Stacks.length !== 1) {
    throw new Error("Expected exactly one deployed preview stack");
  }
  const stack: unknown = value.Stacks[0];
  const stackName = `${prefix}-foundation`;
  if (!isRecord(stack) || stack.StackName !== stackName
    || typeof stack.StackId !== "string"
    || !stack.StackId.startsWith(`arn:aws:cloudformation:us-east-1:${account}:stack/${stackName}/`)
    || !["CREATE_COMPLETE", "UPDATE_COMPLETE", "UPDATE_ROLLBACK_COMPLETE"].includes(String(stack.StackStatus))) {
    throw new Error("Preview stack is missing, belongs to another target, or is not ready");
  }
  if (!Array.isArray(stack.Parameters)
    || stack.Parameters.filter((parameter: unknown) =>
      isRecord(parameter) && parameter.ParameterKey === "LeadIntakeEnabled" && parameter.ParameterValue === "false").length !== 1) {
    throw new Error("Development releases require public lead intake to remain disabled");
  }
  const outputs = readOutputs(stack.Outputs);
  if (outputs.WebPublishRoleArn !== roleArn) throw new Error("Publisher role does not match the deployed stack");
  const bucket = requiredOutput(outputs, "WebBucket", /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/);
  const distributionId = requiredOutput(outputs, "DistributionId", /^[A-Z0-9]{8,32}$/);
  const webUrl = requiredOutput(outputs, "WebUrl", environment === "production"
    ? /^https:\/\/thirddowntech\.com$/
    : /^https:\/\/(?:[a-z0-9]+\.cloudfront\.net|dev\.thirddowntech\.com)$/);
  const apiUrl = requiredOutput(outputs, "ApiUrl", /^https:\/\/[a-z0-9]+\.execute-api\.us-east-1\.amazonaws\.com$/);
  const authUrl = requiredOutput(outputs, "AuthUrl",
    new RegExp(`^https://${prefix}-${account}\\.auth\\.us-east-1\\.amazoncognito\\.com$`));
  const clientId = requiredOutput(outputs, "UserPoolClientId", /^[a-zA-Z0-9]{1,128}$/);
  const userPoolId = requiredOutput(outputs, "UserPoolId", /^us-east-1_[a-zA-Z0-9]+$/);
  return { bucket, distributionId, webUrl, apiUrl, authUrl, clientId, userPoolId };
}

export function verifyPreviewDistribution(value: unknown, release: Pick<PreviewRelease, "bucket" | "distributionId" | "webUrl">,
  env: NodeJS.ProcessEnv = {}): void {
  const { customWebHost, environment } = releaseTarget(env);
  const customWebUrl = `https://${customWebHost}`;
  if (environment === "production" && release.webUrl !== customWebUrl) throw new Error("Production requires its approved custom origin");
  const distribution = isRecord(value) ? value.Distribution : undefined;
  const domainName = isRecord(distribution) ? distribution.DomainName : undefined;
  const config = isRecord(distribution) ? distribution.DistributionConfig : undefined;
  const isCustomDomain = release.webUrl === customWebUrl;
  if (!isRecord(distribution) || distribution.Id !== release.distributionId
    || typeof domainName !== "string" || !/^[a-z0-9]+\.cloudfront\.net$/.test(domainName)
    || (!isCustomDomain && `https://${domainName}` !== release.webUrl) || distribution.Status !== "Deployed") {
    throw new Error("Distribution does not match the ready preview destination");
  }
  if (isCustomDomain) {
    const aliases = isRecord(config) && isRecord(config.Aliases) ? config.Aliases : undefined;
    const certificate = isRecord(config) ? config.ViewerCertificate : undefined;
    if (!isRecord(aliases) || aliases.Quantity !== 1 || !Array.isArray(aliases.Items)
      || aliases.Items.length !== 1 || aliases.Items[0] !== customWebHost
      || !isRecord(certificate)
      || typeof certificate.ACMCertificateArn !== "string"
      || !/^arn:aws:acm:us-east-1:\d{12}:certificate\/[0-9a-f-]{36}$/.test(certificate.ACMCertificateArn)
      || (env.AWS_ACCOUNT_ID && !certificate.ACMCertificateArn.startsWith(`arn:aws:acm:us-east-1:${env.AWS_ACCOUNT_ID}:certificate/`))
      || (environment === "development" && env.AWS_ACCOUNT_ID === "425061472162"
        && certificate.ACMCertificateArn !== developmentCertificateArn)
      || certificate.SSLSupportMethod !== "sni-only"
      || certificate.MinimumProtocolVersion !== "TLSv1.2_2021") {
      throw new Error("Custom preview hostname must match its CloudFront alias and ACM TLS configuration");
    }
  }
  const origins = isRecord(config) && isRecord(config.Origins) ? config.Origins.Items : undefined;
  const errorResponses = isRecord(config) ? config.CustomErrorResponses : undefined;
  if (errorResponses !== undefined && (!isRecord(errorResponses) || errorResponses.Quantity !== 0
    || (errorResponses.Items !== undefined && (!Array.isArray(errorResponses.Items) || errorResponses.Items.length !== 0)))) {
    throw new Error("Web releases forbid custom error fallbacks");
  }
  if (!isRecord(config) || config.Enabled !== true || !Array.isArray(origins) || origins.length !== 1
    || !isRecord(origins[0])
    || origins[0].DomainName !== `${release.bucket}.s3.us-east-1.amazonaws.com`
    || typeof origins[0].OriginAccessControlId !== "string" || !origins[0].OriginAccessControlId) {
    throw new Error("Preview distribution must serve only the stack's private S3 bucket through OAC");
  }
}

export function verifyPreviewBucket(accessBlock: unknown, policyStatus: unknown): void {
  const config = isRecord(accessBlock) ? accessBlock.PublicAccessBlockConfiguration : undefined;
  if (!isRecord(config) || config.BlockPublicAcls !== true || config.BlockPublicPolicy !== true
    || config.IgnorePublicAcls !== true || config.RestrictPublicBuckets !== true) {
    throw new Error("Preview bucket must enable all four public-access blocks");
  }
  const policy = isRecord(policyStatus) ? policyStatus.PolicyStatus : undefined;
  if (!isRecord(policy) || policy.IsPublic !== false) {
    throw new Error("Preview bucket policy must be confirmed non-public");
  }
}

export function verifyPreviewHealth(value: unknown): void {
  if (!isRecord(value) || value.status !== "ok" || value.application !== "consulting") {
    throw new Error("Development API health did not identify the expected application");
  }
}

function readOutputs(value: unknown): Record<string, string> {
  if (!Array.isArray(value)) throw new Error("Deployed stack outputs are missing");
  const outputs: Record<string, string> = {};
  for (const output of value) {
    if (!isRecord(output) || typeof output.OutputKey !== "string" || typeof output.OutputValue !== "string"
      || Object.hasOwn(outputs, output.OutputKey)) throw new Error("Invalid or duplicate deployed stack output");
    Object.defineProperty(outputs, output.OutputKey, { value: output.OutputValue, enumerable: true });
  }
  return outputs;
}

function requiredOutput(outputs: Record<string, string>, key: string, pattern: RegExp): string {
  const value = outputs[key];
  if (!value || !pattern.test(value)) throw new Error(`Invalid or missing ${key} output`);
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
