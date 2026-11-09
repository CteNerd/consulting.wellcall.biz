export const developmentCertificateArn = "arn:aws:acm:us-east-1:425061472162:certificate/f188b0ef-39b4-4020-8c95-1b11a586942f";

export function configuration(environment: unknown, account: unknown, existingDevCertificateArn?: unknown) {
  if (environment !== "development" && environment !== "production") {
    throw new Error("Explicit development or production environment is required");
  }
  if (typeof account !== "string" || !/^[0-9]{12}$/.test(account)) {
    throw new Error("Explicit 12-digit AWS account is required");
  }
  const certificateArn = existingDevCertificateArn
    ?? (environment === "development" && account === "425061472162" ? developmentCertificateArn : undefined);
  if (certificateArn !== undefined && (environment !== "development" || typeof certificateArn !== "string"
    || !new RegExp(`^arn:aws:acm:us-east-1:${account}:certificate/[0-9a-f-]{36}$`).test(certificateArn))) {
    throw new Error("Existing development certificate must be an ACM us-east-1 certificate in the target account");
  }
  return {
    environment,
    account,
    region: "us-east-1",
    prefix: `rct-consulting-${environment}`,
    releaseAssetsBucket: environment === "development"
      ? `rct-consulting-development-assets-${account}-us-east-1`
      : `rct-consulting-production-release-assets-${account}-us-east-1`,
    webDomain: environment === "production" ? "thirddowntech.com" : "dev.thirddowntech.com",
    apiDomain: environment === "production" ? "api.thirddowntech.com" : undefined,
    hostedZoneName: "thirddowntech.com",
    hostedZoneId: "Z04122641H21O7H0LH9PF",
    existingDevCertificateArn: certificateArn as string | undefined,
  } as const;
}

export type Configuration = ReturnType<typeof configuration>;
