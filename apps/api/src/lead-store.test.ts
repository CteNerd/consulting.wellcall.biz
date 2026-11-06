import assert from "node:assert/strict";
import { test } from "node:test";
import { ConditionalCheckFailedException, DynamoDBClient, TransactionCanceledException } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, QueryCommand, TransactWriteCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { buildLeadTransaction, DynamoLeadReader, DynamoLeadStatusWriter, DynamoLeadWriter, IdempotencyConflictError, InvalidLeadCursorError, LeadUpdateConflictError } from "./lead-store.ts";
import { createLeadRecord, type LeadSubmission } from "./leads.ts";

const submission: LeadSubmission = {
  idempotencyKey: "b9de9897-5f48-4a63-a872-1d1b53bd64a5",
  name: "Riley Example",
  email: "person@example.com",
  company: "",
  message: "I would like to discuss a project.",
  consentPolicyVersion: "2026-01",
};

test("lead, idempotency key and PII-free reporting outbox are one conditional transaction", () => {
  const { lead, event } = createLeadRecord(submission, 90, new Date("2026-11-05T16:00:00.000Z"));
  const now = Math.floor(Date.parse(lead.createdAt) / 1000);
  const transaction = buildLeadTransaction("consulting-core", lead, event, now);
  const items = transaction.TransactItems ?? [];
  assert.equal(items.length, 3);
  assert.ok(items.every((item) => item.Put?.TableName === "consulting-core"));
  assert.ok(items.slice(0, 2).every((item) => item.Put?.ConditionExpression === "attribute_not_exists(PK)"));
  assert.equal(items[2]?.Put?.ConditionExpression, "attribute_not_exists(PK) OR expiresAt <= :now");
  assert.deepEqual(items[2]?.Put?.ExpressionAttributeValues, { ":now": now });

  const leadItem = items[0]!.Put!.Item!;
  const outboxItem = items[1]!.Put!.Item!;
  const idempotencyItem = items[2]!.Put!.Item!;
  assert.equal(leadItem.email, "person@example.com");
  assert.equal(leadItem.GSI1PK, "LEAD");
  assert.equal(leadItem.GSI1SK, `${lead.createdAt}#${lead.leadId}`);
  assert.equal(leadItem.status, "NEW");
  assert.equal(leadItem.version, 0);
  assert.equal(leadItem.consentedAt, "2026-11-05T16:00:00.000Z");
  assert.equal(leadItem.consentPolicyVersion, "2026-01");
  assert.equal(idempotencyItem.leadId, lead.leadId);
  assert.equal(idempotencyItem.expiresAt, now + 86400);
  assert.deepEqual(outboxItem.event, event);
  assert.doesNotMatch(JSON.stringify(outboxItem), /person@example\.com|Riley Example|discuss a project/);
});

test("receipt recovery preserves active retries and rejects different submissions", async (t) => {
  const now = Date.parse("2026-11-05T16:00:00.000Z");
  t.mock.method(Date, "now", () => now);
  const client = DynamoDBDocumentClient.from(new DynamoDBClient({ region: "us-east-1" }));
  const { lead, event } = createLeadRecord(submission, 90, new Date(now));
  const existingLead = { ...lead };
  t.mock.method(client, "send", async (command: TransactWriteCommand | GetCommand) => {
    if (command instanceof TransactWriteCommand) {
      throw new TransactionCanceledException({ $metadata: {}, message: "receipt already exists" });
    }
    assert.ok(command instanceof GetCommand);
    assert.equal(command.input.ConsistentRead, true);
    return command.input.Key?.PK === `IDEMPOTENCY#${lead.idempotencyKey}`
      ? { Item: { leadId: lead.leadId, expiresAt: now / 1000 + 1 } }
      : { Item: existingLead };
  });
  const writer = new DynamoLeadWriter(client, "core");
  assert.equal(await writer.create(lead, event), "duplicate");
  existingLead.message = "A different submission.";
  await assert.rejects(writer.create(lead, event), IdempotencyConflictError);
});

test("expired or invalid receipts cannot recover canceled transactions as duplicates", async (t) => {
  const now = Date.parse("2026-11-05T16:00:00.000Z");
  t.mock.method(Date, "now", () => now);
  const client = DynamoDBDocumentClient.from(new DynamoDBClient({ region: "us-east-1" }));
  const { lead, event } = createLeadRecord(submission, 90, new Date(now));
  const canceled = new TransactionCanceledException({ $metadata: {}, message: "transaction canceled" });
  let expiresAt: unknown;
  let reads = 0;
  t.mock.method(client, "send", async (command: TransactWriteCommand | GetCommand) => {
    if (command instanceof TransactWriteCommand) {
      const receipt = command.input.TransactItems?.[2]?.Put;
      assert.equal(receipt?.ConditionExpression, "attribute_not_exists(PK) OR expiresAt <= :now");
      assert.equal(receipt?.ExpressionAttributeValues?.[":now"], now / 1000);
      assert.equal(receipt?.Item?.expiresAt, now / 1000 + 86400);
      throw canceled;
    }
    assert.ok(command instanceof GetCommand);
    reads++;
    return { Item: { leadId: lead.leadId, expiresAt } };
  });
  const writer = new DynamoLeadWriter(client, "core");
  for (expiresAt of [now / 1000 - 1, now / 1000, undefined, "invalid"]) {
    await assert.rejects(writer.create(lead, event), (error) => error === canceled);
  }
  assert.equal(reads, 4);
});

test("lead listing requests bounded expiry filtering and round-trips a validated page cursor", async (t) => {
  const client = DynamoDBDocumentClient.from(new DynamoDBClient({ region: "us-east-1" }));
  const { lead, event } = createLeadRecord(submission, 90, new Date("2099-11-05T16:00:00.000Z"));
  const item = buildLeadTransaction("core", lead, event).TransactItems![0]!.Put!.Item!;
  const key = { PK: item.PK, SK: item.SK, GSI1PK: item.GSI1PK, GSI1SK: item.GSI1SK };
  const queries: QueryCommand[] = [];
  t.mock.method(client, "send", async (command: QueryCommand) => {
    assert.ok(command instanceof QueryCommand);
    queries.push(command);
    return { Items: [item], LastEvaluatedKey: key };
  });
  const reader = new DynamoLeadReader(client, "core");
  const page = await reader.listLatest(undefined);
  assert.equal(page.leads[0]?.status, "NEW");
  assert.equal(page.leads[0]?.version, 0);
  assert.equal(Object.hasOwn(page.leads[0]!, "expiresAt"), false);
  assert.equal(queries[0]?.input.Limit, 25);
  assert.equal(queries[0]?.input.IndexName, "LeadListingIndex");
  assert.equal(queries[0]?.input.FilterExpression, "expiresAt > :now");
  assert.equal(queries[0]?.input.ScanIndexForward, false);
  await reader.listLatest(page.nextToken!);
  assert.deepEqual(queries[1]?.input.ExclusiveStartKey, key);
  const hostileToken = Buffer.from(JSON.stringify({ ...key, PK: "OUTBOX#event" })).toString("base64url");
  await assert.rejects(reader.listLatest(hostileToken), InvalidLeadCursorError);
  assert.equal(queries.length, 2);
  delete item.status;
  delete item.version;
  assert.deepEqual((await reader.listLatest(undefined)).leads[0]?.status, "NEW");
  item.status = "INVALID";
  await assert.rejects(reader.listLatest(undefined), /follow-up fields are invalid/);
});

test("status writer atomically checks version and retention without altering expiry or emitting events", async (t) => {
  const client = DynamoDBDocumentClient.from(new DynamoDBClient({ region: "us-east-1" }));
  const commands: UpdateCommand[] = [];
  t.mock.method(client, "send", async (command: UpdateCommand) => {
    assert.ok(command instanceof UpdateCommand);
    commands.push(command);
    return { Attributes: { status: "CONTACTED", version: 1 } };
  });
  const writer = new DynamoLeadStatusWriter(client, "core");
  const now = new Date("2026-11-05T16:00:00.000Z");
  assert.deepEqual(await writer.updateStatus("lead-1", { status: "CONTACTED", expectedVersion: 0 }, "admin-1", now),
    { status: "CONTACTED", version: 1 });
  const input = commands[0]!.input;
  assert.match(input.ConditionExpression!, /recordType = :lead AND expiresAt > :now/);
  assert.match(input.ConditionExpression!, /attribute_not_exists\(#version\)/);
  assert.equal(input.ExpressionAttributeValues?.[":now"], now.getTime() / 1000);
  assert.equal(input.ExpressionAttributeValues?.[":actor"], "admin-1");
  assert.equal(input.ExpressionAttributeValues?.[":nextVersion"], 1);
  assert.doesNotMatch(input.UpdateExpression!, /expiresAt|event|GSI/);
  await writer.updateStatus("lead-1", { status: "CLOSED", expectedVersion: 1 }, "admin-1", now);
  assert.doesNotMatch(commands[1]!.input.ConditionExpression!, /attribute_not_exists/);
});

test("conditional failures become conflicts but unexpected storage errors are not hidden", async (t) => {
  const client = DynamoDBDocumentClient.from(new DynamoDBClient({ region: "us-east-1" }));
  const send = t.mock.method(client, "send", async () => {
    throw new ConditionalCheckFailedException({ $metadata: {}, message: "condition failed" });
  });
  const writer = new DynamoLeadStatusWriter(client, "core");
  await assert.rejects(writer.updateStatus("lead-1", { status: "NEW", expectedVersion: 0 }, "admin-1", new Date()),
    LeadUpdateConflictError);
  send.mock.mockImplementation(async () => { throw new Error("storage unavailable"); });
  await assert.rejects(writer.updateStatus("lead-1", { status: "NEW", expectedVersion: 0 }, "admin-1", new Date()),
    /storage unavailable/);
});
