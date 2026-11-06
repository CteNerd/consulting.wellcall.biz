export const leadStatusLabels = {
  NEW: "New",
  CONTACTED: "Contacted",
  QUALIFIED: "Qualified",
  CLOSED: "Closed",
} as const;

export type LeadStatus = keyof typeof leadStatusLabels;
export type LeadFollowUp = { status: LeadStatus; version: number };
export type LeadStatusUpdate = { status: LeadStatus; expectedVersion: number };

export function isLeadStatus(value: unknown): value is LeadStatus {
  return typeof value === "string" && Object.hasOwn(leadStatusLabels, value);
}

export function parseLeadStatusUpdate(value: unknown): LeadStatusUpdate | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  const input = value as Record<string, unknown>;
  if (Object.keys(input).sort().join(",") !== "expectedVersion,status"
    || !isLeadStatus(input.status)
    || typeof input.expectedVersion !== "number"
    || !Number.isSafeInteger(input.expectedVersion)
    || input.expectedVersion < 0 || input.expectedVersion >= Number.MAX_SAFE_INTEGER) return undefined;
  return { status: input.status, expectedVersion: input.expectedVersion };
}
