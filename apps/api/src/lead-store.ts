import { TransactionCanceledException } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  QueryCommand,
  TransactWriteCommand,
  type TransactWriteCommandInput,
} from "@aws-sdk/lib-dynamodb";
import type { LeadPage, LeadReader, LeadRecord, LeadWriter, ReportingEvent, StoredLead } from "./leads.ts";

type LeadCursor = { PK: string; SK: string; GSI1PK: string; GSI1SK: string };
const leadIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class InvalidLeadCursorError extends Error {
  constructor() {
    super("Invalid lead page cursor");
  }
}

export class IdempotencyConflictError extends Error {
  constructor() {
    super("Idempotency key was already used for a different submission");
  }
}

export class DynamoLeadWriter implements LeadWriter {
  private readonly client: DynamoDBDocumentClient;
  private readonly tableName: string;

  constructor(client: DynamoDBDocumentClient, tableName: string) {
    this.client = client;
    this.tableName = tableName;
  }

  async create(lead: StoredLead, event: ReportingEvent): Promise<"created" | "duplicate"> {
    const idempotencyKey = { PK: `IDEMPOTENCY#${lead.idempotencyKey}`, SK: "LEAD" };
    try {
      await this.client.send(new TransactWriteCommand(buildLeadTransaction(this.tableName, lead, event)));
      return "created";
    } catch (error) {
      if (!(error instanceof TransactionCanceledException)) throw error;
      const existing = await this.client.send(new GetCommand({
        TableName: this.tableName, Key: idempotencyKey, ConsistentRead: true,
      }));
      if (!existing.Item || typeof existing.Item.leadId !== "string") throw error;
      const existingLead = await this.client.send(new GetCommand({
        TableName: this.tableName,
        Key: { PK: `LEAD#${existing.Item.leadId}`, SK: "METADATA" },
        ConsistentRead: true,
      }));
      if (!existingLead.Item || !sameSubmission(existingLead.Item, lead)) throw new IdempotencyConflictError();
      return "duplicate";
    }
  }
}

export class DynamoLeadReader implements LeadReader {
  private readonly client: DynamoDBDocumentClient;
  private readonly tableName: string;

  constructor(client: DynamoDBDocumentClient, tableName: string) {
    this.client = client;
    this.tableName = tableName;
  }

  async listLatest(nextToken: string | undefined): Promise<LeadPage> {
    const cursor = nextToken === undefined ? undefined : decodeLeadCursor(nextToken);
    const result = await this.client.send(new QueryCommand({
      TableName: this.tableName,
      IndexName: "LeadListingIndex",
      KeyConditionExpression: "GSI1PK = :lead",
      ExpressionAttributeValues: { ":lead": "LEAD" },
      ScanIndexForward: false,
      Limit: 25,
      ...(cursor === undefined ? {} : { ExclusiveStartKey: cursor }),
    }));
    const leads = (result.Items ?? []).map(toLeadRecord);
    const lastKey = result.LastEvaluatedKey;
    return {
      leads,
      nextToken: lastKey === undefined ? null : encodeLeadCursor(lastKey),
    };
  }
}

export function buildLeadTransaction(
  tableName: string,
  lead: StoredLead,
  event: ReportingEvent,
): TransactWriteCommandInput {
  return {
    TransactItems: [
      {
        Put: {
          TableName: tableName,
          Item: {
            PK: `LEAD#${lead.leadId}`, SK: "METADATA", recordType: "LEAD",
            GSI1PK: "LEAD", GSI1SK: `${lead.createdAt}#${lead.leadId}`,
            name: lead.name, email: lead.email, company: lead.company, message: lead.message,
            leadId: lead.leadId, consentPolicyVersion: lead.consentPolicyVersion,
            createdAt: lead.createdAt, consentedAt: lead.consentedAt, expiresAt: lead.expiresAt,
          },
          ConditionExpression: "attribute_not_exists(PK)",
        },
      },
      {
        Put: {
          TableName: tableName,
          Item: {
            PK: `OUTBOX#${event.detail.eventId}`, SK: "EVENT", recordType: "OUTBOX",
            event, status: "PENDING", GSI2PK: "PENDING",
            GSI2SK: `${event.detail.occurredAt}#${event.detail.eventId}`,
          },
          ConditionExpression: "attribute_not_exists(PK)",
        },
      },
      {
        Put: {
          TableName: tableName,
          Item: {
            PK: `IDEMPOTENCY#${lead.idempotencyKey}`, SK: "LEAD", leadId: lead.leadId,
            expiresAt: Math.floor(Date.now() / 1000) + 86400,
          },
          ConditionExpression: "attribute_not_exists(PK)",
        },
      },
    ],
  };
}

function toLeadRecord(item: Record<string, unknown>): LeadRecord {
  return {
    leadId: recordString(item, "leadId"),
    name: recordString(item, "name"),
    email: recordString(item, "email"),
    company: recordString(item, "company"),
    message: recordString(item, "message"),
    createdAt: recordString(item, "createdAt"),
    consentedAt: recordString(item, "consentedAt"),
    consentPolicyVersion: recordString(item, "consentPolicyVersion"),
  };
}

function recordString(item: Record<string, unknown>, key: string): string {
  const value = item[key];
  if (typeof value !== "string") throw new Error("Stored lead record is missing required fields");
  return value;
}

function encodeLeadCursor(value: Record<string, unknown>): string {
  const cursor = {
    PK: value.PK,
    SK: value.SK,
    GSI1PK: value.GSI1PK,
    GSI1SK: value.GSI1SK,
  };
  if (!isLeadCursor(cursor)) throw new Error("Unable to create lead page cursor");
  return Buffer.from(JSON.stringify(cursor)).toString("base64url");
}

function decodeLeadCursor(value: string): LeadCursor {
  if (value.length > 2048 || !/^[A-Za-z0-9_-]+$/.test(value)) throw new InvalidLeadCursorError();
  try {
    const parsed: unknown = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    if (!isLeadCursor(parsed)) throw new InvalidLeadCursorError();
    return parsed;
  } catch (error) {
    if (error instanceof InvalidLeadCursorError) throw error;
    throw new InvalidLeadCursorError();
  }
}

function isLeadCursor(value: unknown): value is LeadCursor {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const cursor = value as Record<string, unknown>;
  if (Object.keys(cursor).sort().join(",") !== "GSI1PK,GSI1SK,PK,SK") return false;
  if (cursor.SK !== "METADATA" || cursor.GSI1PK !== "LEAD") return false;
  if (typeof cursor.PK !== "string" || !cursor.PK.startsWith("LEAD#")) return false;
  if (typeof cursor.GSI1SK !== "string") return false;
  const leadId = cursor.PK.slice("LEAD#".length);
  const [createdAt, sortKeyLeadId, extra] = cursor.GSI1SK.split("#");
  if (extra !== undefined || sortKeyLeadId !== leadId || !leadIdPattern.test(leadId) || !createdAt) return false;
  const date = new Date(createdAt);
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(createdAt)
    && Number.isFinite(date.getTime())
    && date.toISOString() === createdAt;
}

function sameSubmission(existing: Record<string, unknown>, submitted: StoredLead): boolean {
  return existing.name === submitted.name
    && existing.email === submitted.email
    && existing.company === submitted.company
    && existing.message === submitted.message
    && existing.consentPolicyVersion === submitted.consentPolicyVersion;
}
