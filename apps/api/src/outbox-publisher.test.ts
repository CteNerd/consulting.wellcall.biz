import assert from "node:assert/strict";
import { test } from "node:test";
import { marshall } from "@aws-sdk/util-dynamodb";
import type { DynamoDBStreamEvent, ScheduledEvent } from "aws-lambda";
import { createOutboxPublisher } from "./outbox-publisher.ts";
import type { ReportingEvent } from "./leads.ts";

const event: ReportingEvent = {
  source: "rct.consulting",
  "detail-type": "consulting.lead.created.v1",
  detail: {
    eventId: "00000000-0000-4000-8000-000000000001",
    schemaVersion: 1,
    occurredAt: "2026-11-05T16:00:00.000Z",
    correlationId: "00000000-0000-4000-8000-000000000002",
    domain: "consulting",
    data: { reportingMonth: "2026-11", leadCount: 1 },
  },
};

function streamEvent(value: ReportingEvent = event): DynamoDBStreamEvent {
  return {
    Records: [{
      eventName: "INSERT",
      eventSource: "aws:dynamodb",
      eventVersion: "1.1",
      eventID: "record-1",
      awsRegion: "us-east-1",
      eventSourceARN: "arn:aws:dynamodb:us-east-1:123456789012:table/core/stream/test",
      dynamodb: {
        ApproximateCreationDateTime: 0,
        Keys: marshall({ PK: "OUTBOX#event-1", SK: "EVENT" }),
        NewImage: marshall({
          PK: "OUTBOX#event-1", SK: "EVENT", recordType: "OUTBOX",
          event: value, status: "PENDING",
        }),
        SequenceNumber: "123",
        SizeBytes: 10,
        StreamViewType: "NEW_IMAGE",
      },
    }],
  } as DynamoDBStreamEvent;
}

test("stream publisher sends only sanitized events and acknowledges delivered outbox records", async () => {
  const published: ReportingEvent[] = [];
  const marked: string[] = [];
  const handler = createOutboxPublisher({
    publish: async (item) => { published.push(item); },
    markDelivered: async (item) => { marked.push(item.PK); },
    findPending: async () => [],
  });
  const result = await handler(streamEvent());
  assert.deepEqual(result, { batchItemFailures: [] });
  assert.deepEqual(published, [event]);
  assert.deepEqual(marked, ["OUTBOX#event-1"]);
  assert.equal(JSON.stringify(published).includes("email"), false);
});

test("stream publisher reports failed records for bounded retry", async () => {
  const handler = createOutboxPublisher({
    publish: async () => { throw new Error("transport unavailable"); },
    markDelivered: async () => { assert.fail("failed event must remain pending"); },
    findPending: async () => [],
  });
  assert.deepEqual(await handler(streamEvent()), {
    batchItemFailures: [{ itemIdentifier: "123" }],
  });
});

test("scheduled reconciliation retries pending events and fails visibly when delivery fails", async () => {
  const marked: string[] = [];
  const pending = { PK: "OUTBOX#event-1", SK: "EVENT", event, status: "PENDING" };
  const handler = createOutboxPublisher({
    publish: async () => undefined,
    markDelivered: async (item) => { marked.push(item.PK); },
    findPending: async () => [pending],
  });
  const scheduled = { "detail-type": "Scheduled Event" } as ScheduledEvent;
  assert.deepEqual(await handler(scheduled), { delivered: 1 });
  assert.deepEqual(marked, ["OUTBOX#event-1"]);

  const failed = createOutboxPublisher({
    publish: async () => { throw new Error("transport unavailable"); },
    markDelivered: async () => undefined,
    findPending: async () => [pending],
  });
  await assert.rejects(() => failed(scheduled), /Failed to deliver 1 pending/);
});

test("publisher rejects malformed or PII-bearing outbox payloads without sending them", async () => {
  const published: ReportingEvent[] = [];
  const handler = createOutboxPublisher({
    publish: async (item) => { published.push(item); },
    markDelivered: async () => undefined,
    findPending: async () => [],
  });
  const unsafe = {
    ...event,
    detail: { ...event.detail, data: { ...event.detail.data, email: "person@example.com" } },
  };
  assert.deepEqual(await handler(streamEvent(unsafe)), {
    batchItemFailures: [{ itemIdentifier: "123" }],
  });
  assert.deepEqual(published, []);

  const marked: string[] = [];
  const reconciler = createOutboxPublisher({
    publish: async (item) => { published.push(item); },
    markDelivered: async (item) => { marked.push(item.PK); },
    findPending: async () => [{ PK: "OUTBOX#event-1", SK: "EVENT", event: unsafe, status: "PENDING" }],
  });
  await assert.rejects(reconciler({ "detail-type": "Scheduled Event" } as ScheduledEvent), /Failed to deliver 1 pending/);
  assert.deepEqual(published, []);
  assert.deepEqual(marked, []);
});
