import { TransactionCanceledException } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  TransactWriteCommand,
  type TransactWriteCommandInput,
} from "@aws-sdk/lib-dynamodb";
import type { LeadWriter, ReportingEvent, StoredLead } from "./leads.ts";

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

function sameSubmission(existing: Record<string, unknown>, submitted: StoredLead): boolean {
  return existing.name === submitted.name
    && existing.email === submitted.email
    && existing.company === submitted.company
    && existing.message === submitted.message
    && existing.consentPolicyVersion === submitted.consentPolicyVersion;
}
