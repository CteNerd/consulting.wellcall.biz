import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { DynamoLeadReader, DynamoLeadWriter, IdempotencyConflictError, InvalidLeadCursorError } from "./lead-store.ts";
import { createLeadRecord, parseLeadSubmission, type LeadReader, type LeadWriter } from "./leads.ts";

export type Request = APIGatewayProxyEventV2 & {
  requestContext: {
    authorizer?: { jwt?: { claims?: Record<string, unknown> } };
  };
};

export type LeadIntakeConfig = {
  enabled: boolean;
  consentPolicyVersion: string;
  retentionDays: number;
};

type HandlerDependencies = {
  leadWriter: LeadWriter;
  leadReader?: LeadReader;
  leadIntake: LeadIntakeConfig;
  now?: () => Date;
};

const maxBodyBytes = 16 * 1024;
const adminGroup = "ConsultingAdministrators";

function response(statusCode: number, body: object): APIGatewayProxyStructuredResultV2 {
  return {
    statusCode,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
    body: JSON.stringify(body),
  };
}

export function createApiHandler(dependencies: HandlerDependencies) {
  return async (event: Request): Promise<APIGatewayProxyStructuredResultV2> => {
    const method = event.requestContext.http.method;
    if (method === "GET" && event.rawPath === "/health") {
      return response(200, { status: "ok", application: "consulting" });
    }
    if (method === "GET" && event.rawPath === "/me") {
      const subject = event.requestContext.authorizer?.jwt?.claims?.sub;
      if (typeof subject !== "string" || subject.length === 0) {
        return response(401, { error: "Authentication required" });
      }
      return response(200, { userId: subject });
    }
    if (method === "GET" && event.rawPath === "/admin/leads") {
      return listLeads(event, dependencies);
    }
    if (method === "POST" && event.rawPath === "/leads") {
      return submitLead(event, dependencies);
    }
    return response(404, { error: "Not found" });
  };
}

async function listLeads(
  event: Request,
  dependencies: HandlerDependencies,
): Promise<APIGatewayProxyStructuredResultV2> {
  const claims = event.requestContext.authorizer?.jwt?.claims;
  const subject = claims?.sub;
  if (typeof subject !== "string" || subject.length === 0) {
    return response(401, { error: "Authentication required" });
  }
  if (!hasAdminGroup(claims?.["cognito:groups"])) {
    return response(403, { error: "Administrator access required" });
  }
  if (!dependencies.leadReader) return response(503, { error: "Lead inbox is not available" });
  const nextToken = event.queryStringParameters?.nextToken;
  if (nextToken !== undefined && nextToken.length > 2048) {
    return response(400, { error: "Invalid page token" });
  }
  try {
    const page = await dependencies.leadReader.listLatest(nextToken);
    console.info(JSON.stringify({
      event: "admin_lead_list_access",
      actorSub: subject,
      requestId: event.requestContext.requestId,
      resultCount: page.leads.length,
    }));
    return response(200, page);
  } catch (error) {
    if (error instanceof InvalidLeadCursorError) return response(400, { error: "Invalid page token" });
    console.error("Lead inbox read failed", error instanceof Error ? error.name : "UnknownError");
    return response(500, { error: "Unable to load lead inbox" });
  }
}

function hasAdminGroup(value: unknown): boolean {
  if (Array.isArray(value)) return value.some((group) => group === adminGroup);
  if (typeof value !== "string") return false;
  if (value === adminGroup) return true;
  try {
    const groups: unknown = JSON.parse(value);
    return Array.isArray(groups) && groups.some((group) => group === adminGroup);
  } catch {
    return false;
  }
}

async function submitLead(
  event: Request,
  dependencies: HandlerDependencies,
): Promise<APIGatewayProxyStructuredResultV2> {
  const { leadIntake, leadWriter, now = () => new Date() } = dependencies;
  if (!leadIntake.enabled || !leadIntake.consentPolicyVersion
    || !Number.isInteger(leadIntake.retentionDays)
    || leadIntake.retentionDays < 1 || leadIntake.retentionDays > 3650) {
    return response(503, { error: "Inquiry submissions are not available" });
  }
  const contentType = event.headers["content-type"]?.split(";")[0]?.trim().toLowerCase();
  if (contentType !== "application/json") return response(415, { error: "JSON content type required" });
  if (event.body === undefined) return response(400, { error: "Invalid submission" });
  if (event.body.length > Math.ceil(maxBodyBytes * 4 / 3) + 4) {
    return response(413, { error: "Submission is too large" });
  }

  let body: unknown;
  try {
    const raw = event.isBase64Encoded ? Buffer.from(event.body, "base64") : Buffer.from(event.body);
    if (raw.byteLength > maxBodyBytes) return response(413, { error: "Submission is too large" });
    body = JSON.parse(raw.toString("utf8"));
  } catch {
    return response(400, { error: "Invalid submission" });
  }

  const submission = parseLeadSubmission(body, event.headers["idempotency-key"], leadIntake.consentPolicyVersion);
  if (!submission) return response(400, { error: "Invalid submission" });
  const { lead, event: reportingEvent } = createLeadRecord(submission, leadIntake.retentionDays, now());
  try {
    const result = await leadWriter.create(lead, reportingEvent);
    return response(result === "created" ? 201 : 200, { status: "accepted" });
  } catch (error) {
    if (error instanceof IdempotencyConflictError) return response(409, { error: "Submission key conflict" });
    console.error("Lead submission failed", error instanceof Error ? error.name : "UnknownError");
    return response(500, { error: "Unable to submit inquiry" });
  }
}

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const configuredRetentionDays = Number(process.env.LEAD_RETENTION_DAYS);
const configuredConsentVersion = process.env.LEAD_CONSENT_POLICY_VERSION?.trim() ?? "";
export const handler = createApiHandler({
  leadWriter: new DynamoLeadWriter(client, process.env.CORE_TABLE_NAME ?? ""),
  leadReader: new DynamoLeadReader(client, process.env.CORE_TABLE_NAME ?? ""),
  leadIntake: {
    enabled: process.env.LEAD_INTAKE_ENABLED === "true",
    consentPolicyVersion: configuredConsentVersion,
    retentionDays: configuredRetentionDays,
  },
});
