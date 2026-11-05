export function configuration(environment: unknown, account: unknown) {
  if (environment !== "development" && environment !== "production") {
    throw new Error("Explicit development or production environment is required");
  }
  if (typeof account !== "string" || !/^[0-9]{12}$/.test(account)) {
    throw new Error("Explicit 12-digit AWS account is required");
  }
  return {
    environment,
    account,
    region: "us-east-1",
    prefix: `rct-consulting-${environment}`,
    webDomain: environment === "production" ? "thirddowntech.com" : "dev.thirddowntech.com",
    apiDomain: environment === "production" ? "api.thirddowntech.com" : undefined,
    hostedZoneName: "thirddowntech.com",
    hostedZoneId: "Z04122641H21O7H0LH9PF",
  } as const;
}

export type Configuration = ReturnType<typeof configuration>;
