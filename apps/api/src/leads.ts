import { randomUUID } from "node:crypto";

export type LeadSubmission = {
  idempotencyKey: string;
  name: string;
  email: string;
  company: string;
  message: string;
  consentPolicyVersion: string;
};

export type ReportingEvent = {
  source: "rct.consulting";
  "detail-type": "consulting.lead.created.v1";
  detail: {
    eventId: string;
    schemaVersion: 1;
    occurredAt: string;
    correlationId: string;
    domain: "consulting";
    data: { reportingMonth: string; leadCount: 1 };
  };
};

export type StoredLead = LeadSubmission & {
  leadId: string;
  createdAt: string;
  consentedAt: string;
  expiresAt: number;
};

export type LeadRecord = {
  leadId: string;
  name: string;
  email: string;
  company: string;
  message: string;
  createdAt: string;
  consentedAt: string;
  consentPolicyVersion: string;
};

export type LeadPage = { leads: LeadRecord[]; nextToken: string | null };

export type LeadWriter = {
  create(lead: StoredLead, event: ReportingEvent): Promise<"created" | "duplicate">;
};

export type LeadReader = {
  listLatest(nextToken: string | undefined): Promise<LeadPage>;
};

export function isReportingEvent(value: unknown): value is ReportingEvent {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const event = value as Record<string, unknown>;
  if (Object.keys(event).sort().join(",") !== "detail,detail-type,source") return false;
  if (event.source !== "rct.consulting" || event["detail-type"] !== "consulting.lead.created.v1") return false;
  if (typeof event.detail !== "object" || event.detail === null || Array.isArray(event.detail)) return false;
  const detail = event.detail as Record<string, unknown>;
  if (Object.keys(detail).sort().join(",") !== "correlationId,data,domain,eventId,occurredAt,schemaVersion") return false;
  if (detail.domain !== "consulting" || detail.schemaVersion !== 1) return false;
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (typeof detail.eventId !== "string" || !uuid.test(detail.eventId)) return false;
  if (typeof detail.correlationId !== "string" || !uuid.test(detail.correlationId)) return false;
  if (typeof detail.occurredAt !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(detail.occurredAt)
    || !Number.isFinite(Date.parse(detail.occurredAt))
    || new Date(detail.occurredAt).toISOString() !== detail.occurredAt) return false;
  if (typeof detail.data !== "object" || detail.data === null || Array.isArray(detail.data)) return false;
  const data = detail.data as Record<string, unknown>;
  return Object.keys(data).sort().join(",") === "leadCount,reportingMonth"
    && data.leadCount === 1
    && typeof data.reportingMonth === "string"
    && /^\d{4}-(0[1-9]|1[0-2])$/.test(data.reportingMonth)
    && data.reportingMonth === detail.occurredAt.slice(0, 7);
}

export function parseLeadSubmission(
  value: unknown,
  idempotencyKey: string | undefined,
  consentPolicyVersion: string,
): LeadSubmission | undefined {
  if (!idempotencyKey || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(idempotencyKey)) {
    return undefined;
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  const body = value as Record<string, unknown>;
  const allowed = new Set(["name", "email", "company", "message", "consent", "consentPolicyVersion", "website"]);
  if (Object.keys(body).some((key) => !allowed.has(key))) return undefined;
  if (typeof body.website !== "undefined" && body.website !== "") return undefined;
  if (body.consent !== true || body.consentPolicyVersion !== consentPolicyVersion) return undefined;

  const name = normalizedText(body.name, 100);
  const emailValue = normalizedText(body.email, 254);
  if (!emailValue) return undefined;
  const email = emailValue.toLowerCase();
  const company = body.company === undefined ? "" : normalizedText(body.company, 120);
  const message = normalizedText(body.message, 3000, true);
  if (!name || !email || company === undefined || !message) return undefined;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || message.length < 10) return undefined;
  return { idempotencyKey, name, email, company, message, consentPolicyVersion };
}

function normalizedText(value: unknown, maxLength: number, allowNewlines = false): string | undefined {
  if (typeof value !== "string") return undefined;
  const text = allowNewlines ? value.replace(/\r\n?/g, "\n").trim() : value.trim();
  const controlCharacters = allowNewlines
    ? /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/
    : /[\u0000-\u001f\u007f]/;
  if (text.length > maxLength || controlCharacters.test(text)) return undefined;
  return text;
}

export function createLeadRecord(
  submission: LeadSubmission,
  retentionDays: number,
  now: Date,
): { lead: StoredLead; event: ReportingEvent } {
  const occurredAt = now.toISOString();
  const leadId = randomUUID();
  const event: ReportingEvent = {
    source: "rct.consulting",
    "detail-type": "consulting.lead.created.v1",
    detail: {
      eventId: randomUUID(),
      schemaVersion: 1,
      occurredAt,
      correlationId: randomUUID(),
      domain: "consulting",
      data: { reportingMonth: occurredAt.slice(0, 7), leadCount: 1 },
    },
  };
  return {
    lead: {
      ...submission,
      leadId,
      createdAt: occurredAt,
      consentedAt: occurredAt,
      expiresAt: Math.floor(now.getTime() / 1000) + retentionDays * 86400,
    },
    event,
  };
}
