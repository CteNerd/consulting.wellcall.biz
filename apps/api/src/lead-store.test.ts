import assert from "node:assert/strict";
import { test } from "node:test";
import { buildLeadTransaction } from "./lead-store.ts";
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
  const transaction = buildLeadTransaction("consulting-core", lead, event);
  const items = transaction.TransactItems ?? [];
  assert.equal(items.length, 3);
  assert.ok(items.every((item) => item.Put?.TableName === "consulting-core"));
  assert.ok(items.every((item) => item.Put?.ConditionExpression === "attribute_not_exists(PK)"));

  const leadItem = items[0]!.Put!.Item!;
  const outboxItem = items[1]!.Put!.Item!;
  const idempotencyItem = items[2]!.Put!.Item!;
  assert.equal(leadItem.email, "person@example.com");
  assert.equal(leadItem.consentedAt, "2026-11-05T16:00:00.000Z");
  assert.equal(leadItem.consentPolicyVersion, "2026-01");
  assert.equal(idempotencyItem.leadId, lead.leadId);
  assert.deepEqual(outboxItem.event, event);
  assert.doesNotMatch(JSON.stringify(outboxItem), /person@example\.com|Riley Example|discuss a project/);
});
