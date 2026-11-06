import { ConditionalCheckFailedException, DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { EventBridgeClient, PutEventsCommand } from "@aws-sdk/client-eventbridge";
import { DynamoDBDocumentClient, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import type { DynamoDBStreamEvent, ScheduledEvent } from "aws-lambda";
import { isReportingEvent, type ReportingEvent } from "./leads.ts";

type OutboxItem = {
  PK: string;
  SK: string;
  event: ReportingEvent;
  status: string;
};

type PublisherDependencies = {
  publish(event: ReportingEvent): Promise<void>;
  markDelivered(item: OutboxItem): Promise<void>;
  findPending(): Promise<OutboxItem[]>;
};

export function createOutboxPublisher(dependencies: PublisherDependencies) {
  return async (input: DynamoDBStreamEvent | ScheduledEvent) => {
    if ("Records" in input) {
      const batchItemFailures: { itemIdentifier: string }[] = [];
      for (const record of input.Records) {
        if (record.eventName !== "INSERT" || !record.dynamodb?.NewImage) continue;
        const image = record.dynamodb.NewImage;
        if (image.recordType?.S !== "OUTBOX") continue;
        const eventValue = image.event?.M ? decodeMap(image.event.M) : undefined;
        if (!image.PK?.S || !image.SK?.S || !isReportingEvent(eventValue)) {
          if (!record.dynamodb.SequenceNumber) throw new Error("Outbox stream record has no sequence number");
          batchItemFailures.push({ itemIdentifier: record.dynamodb.SequenceNumber });
          continue;
        }
        try {
          await deliver({
            PK: image.PK.S,
            SK: image.SK.S,
            event: eventValue,
            status: image.status?.S ?? "UNKNOWN",
          }, dependencies);
        } catch {
          if (!record.dynamodb.SequenceNumber) throw new Error("Outbox stream record has no sequence number");
          batchItemFailures.push({ itemIdentifier: record.dynamodb.SequenceNumber });
        }
      }
      return { batchItemFailures };
    }

    const pending = await dependencies.findPending();
    const failures: Error[] = [];
    for (const item of pending) {
      try {
        await deliver(item, dependencies);
      } catch (error) {
        failures.push(error instanceof Error ? error : new Error("Unknown outbox delivery failure"));
      }
    }
    if (failures.length > 0) {
      throw new Error(`Failed to deliver ${failures.length} pending outbox event(s)`);
    }
    return { delivered: pending.length };
  };
}

async function deliver(item: OutboxItem, dependencies: PublisherDependencies): Promise<void> {
  await dependencies.publish(item.event);
  await dependencies.markDelivered(item);
}

const tableName = process.env.CORE_TABLE_NAME ?? "";
const busArn = process.env.EVENT_BUS_ARN ?? "";
const documentClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const eventBridge = new EventBridgeClient({});

type StreamAttribute = NonNullable<DynamoDBStreamEvent["Records"][number]["dynamodb"]>["NewImage"];

function decodeMap(value: NonNullable<StreamAttribute>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).map(([key, attribute]) => [key, decodeValue(attribute)]));
}

function decodeValue(value: NonNullable<StreamAttribute>[string]): unknown {
  if (value.S !== undefined) return value.S;
  if (value.N !== undefined) return Number(value.N);
  if (value.BOOL !== undefined) return value.BOOL;
  if (value.NULL) return null;
  if (value.M) return decodeMap(value.M);
  if (value.L) return value.L.map(decodeValue);
  throw new Error("Unsupported DynamoDB outbox attribute");
}

export const handler = createOutboxPublisher({
  async publish(event) {
    const result = await eventBridge.send(new PutEventsCommand({
      Entries: [{
        EventBusName: busArn,
        Source: event.source,
        DetailType: event["detail-type"],
        Detail: JSON.stringify(event.detail),
      }],
    }));
    const entry = result.Entries?.[0];
    if (result.FailedEntryCount !== 0 || !entry?.EventId || entry.ErrorCode) {
      throw new Error("EventBridge did not accept the reporting event");
    }
  },
  async markDelivered(item) {
    try {
      await documentClient.send(new UpdateCommand({
        TableName: tableName,
        Key: { PK: item.PK, SK: item.SK },
        UpdateExpression: "SET #status = :delivered REMOVE GSI2PK, GSI2SK",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: { ":delivered": "DELIVERED", ":pending": "PENDING" },
        ConditionExpression: "#status = :pending",
      }));
    } catch (error) {
      if (!(error instanceof ConditionalCheckFailedException)) throw error;
    }
  },
  async findPending() {
    const result = await documentClient.send(new QueryCommand({
      TableName: tableName,
      IndexName: "OutboxPendingIndex",
      KeyConditionExpression: "GSI2PK = :pending",
      ExpressionAttributeValues: { ":pending": "PENDING" },
      Limit: 100,
    }));
    return (result.Items ?? []) as OutboxItem[];
  },
});
