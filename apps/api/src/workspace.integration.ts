import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import {
  CreateTableCommand, DeleteTableCommand, DynamoDBClient, waitUntilTableExists,
} from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import { canAccessProject } from "../../../packages/domain/src/authorization.ts";
import {
  parseTimeDraftUpdate, parseTimeReview, parseTimeSubmission, type TimeEntry,
} from "../../../packages/domain/src/workspace.ts";
import { handleWorkspaceRequest } from "./workspace-api.ts";
import type { Request } from "./handler.ts";
import { DynamoWorkspaceStore } from "./workspace-store.ts";

const endpoint = process.env.DYNAMODB_ENDPOINT;
if (!endpoint) throw new Error("DYNAMODB_ENDPOINT is required for the DynamoDB Local workspace integration");
const target = new URL(endpoint);
if (target.protocol !== "http:"
  || !["127.0.0.1", "localhost", "::1", "[::1]"].includes(target.hostname)
  || target.username || target.password || target.pathname !== "/" || target.search || target.hash) {
  throw new Error("Workspace integration requires an HTTP loopback DynamoDB Local endpoint");
}

const projectId = randomUUID();
const managerId = "synthetic-project-manager";
const contributorId = "synthetic-contributor";
const unassignedId = "synthetic-unassigned-member";

function request(
  path: string, method = "GET", body?: Record<string, unknown>, subject = contributorId,
): Request {
  const routeKey = `${method} ${path}`;
  const now = new Date();
  return {
    version: "2.0",
    routeKey,
    rawPath: path,
    rawQueryString: "",
    headers: body === undefined ? {} : { "content-type": "application/json" },
    isBase64Encoded: false,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    requestContext: {
      accountId: "local",
      apiId: "local",
      domainName: "localhost",
      domainPrefix: "localhost",
      requestId: randomUUID(),
      routeKey,
      stage: "local",
      time: now.toISOString(),
      timeEpoch: now.getTime(),
      http: {
        method, path, protocol: "HTTP/1.1", sourceIp: "127.0.0.1", userAgent: "workspace-integration",
      },
      authorizer: { jwt: { claims: { sub: subject } } },
    },
  };
}

function parseEntry(body: string | undefined): TimeEntry {
  const value: unknown = JSON.parse(body ?? "null");
  assert.equal(typeof value, "object");
  assert.notEqual(value, null);
  return value as TimeEntry;
}

async function seedRecord(
  document: DynamoDBDocumentClient, tableName: string, item: Record<string, unknown>,
): Promise<void> {
  await document.send(new PutCommand({ TableName: tableName, Item: item }));
}

test("workspace time correction and review transactions persist expected versions and immutable audit", async (t) => {
  const client = new DynamoDBClient({
    endpoint,
    region: "us-east-1",
    credentials: { accessKeyId: "local", secretAccessKey: "local" },
  });
  const document = DynamoDBDocumentClient.from(client);
  const tableName = `consulting-workspace-local-${randomUUID()}`;
  let created = false;
  try {
    await client.send(new CreateTableCommand({
      TableName: tableName,
      BillingMode: "PAY_PER_REQUEST",
      AttributeDefinitions: [
        "PK", "SK", "GSI1PK", "GSI1SK", "GSI2PK", "GSI2SK", "GSI3PK", "GSI3SK",
      ].map((AttributeName) => ({ AttributeName, AttributeType: "S" })),
      KeySchema: [
        { AttributeName: "PK", KeyType: "HASH" },
        { AttributeName: "SK", KeyType: "RANGE" },
      ],
      GlobalSecondaryIndexes: [
        {
          IndexName: "LeadListingIndex",
          KeySchema: [
            { AttributeName: "GSI1PK", KeyType: "HASH" },
            { AttributeName: "GSI1SK", KeyType: "RANGE" },
          ],
          Projection: {
            ProjectionType: "INCLUDE",
            NonKeyAttributes: [
              "leadId", "name", "email", "company", "message", "createdAt",
              "consentedAt", "consentPolicyVersion", "status", "version", "expiresAt",
            ],
          },
        },
        {
          IndexName: "OutboxPendingIndex",
          KeySchema: [
            { AttributeName: "GSI2PK", KeyType: "HASH" },
            { AttributeName: "GSI2SK", KeyType: "RANGE" },
          ],
          Projection: { ProjectionType: "ALL" },
        },
        {
          IndexName: "WorkspaceIndex",
          KeySchema: [
            { AttributeName: "GSI3PK", KeyType: "HASH" },
            { AttributeName: "GSI3SK", KeyType: "RANGE" },
          ],
          Projection: { ProjectionType: "ALL" },
        },
      ],
    }));
    created = true;
    await waitUntilTableExists({
      client, minDelay: 1, maxDelay: 1, maxWaitTime: 20,
    }, { TableName: tableName });

    await seedRecord(document, tableName, {
      PK: `PROJECT#${projectId}`, SK: "METADATA", recordType: "PROJECT",
      projectId, name: "Synthetic workspace project", status: "ACTIVE",
    });
    for (const [userId, role] of [
      [managerId, "manager"],
      [contributorId, "contributor"],
    ] as const) {
      await seedRecord(document, tableName, {
        PK: `USER#${userId}`, SK: "MEMBERSHIP", recordType: "MEMBERSHIP",
        userId, active: true, financeAccess: false,
      });
      await seedRecord(document, tableName, {
        PK: `PROJECT#${projectId}`, SK: `ASSIGNMENT#${userId}`, recordType: "ASSIGNMENT",
        userId, projectId, role, active: true,
        GSI3PK: `USER#${userId}`, GSI3SK: `ASSIGNMENT#${projectId}`,
      });
    }
    await seedRecord(document, tableName, {
      PK: `USER#${unassignedId}`, SK: "MEMBERSHIP", recordType: "MEMBERSHIP",
      userId: unassignedId, active: true, financeAccess: false,
    });
    const contributorTaskId = randomUUID();
    const managerTaskId = randomUUID();
    for (const [taskId, assignedToUserId, title] of [
      [contributorTaskId, contributorId, "Contributor task"],
      [managerTaskId, managerId, "Manager task"],
    ]) {
      await seedRecord(document, tableName, {
        PK: `PROJECT#${projectId}`, SK: `TASK#${taskId}`, recordType: "TASK",
        projectId, taskId, title, description: "", assignedToUserId,
        status: "TODO", version: 0,
        createdAt: "2026-11-09T12:00:00.000Z", updatedAt: "2026-11-09T12:00:00.000Z",
        GSI3PK: `USER#${assignedToUserId}`, GSI3SK: `TASK#${projectId}#${taskId}`,
      });
    }

    const store = new DynamoWorkspaceStore(document, tableName);
    const managerContext = await store.getContext(managerId, projectId);
    const contributorContext = await store.getContext(contributorId, projectId);
    assert.equal(managerContext?.assignment.role, "manager");
    assert.equal(contributorContext?.assignment.role, "contributor");
    assert.equal(await store.getContext(unassignedId, projectId), null);
    assert.equal(canAccessProject(
      contributorContext!.membership, contributorContext!.assignment, { projectId }, "read",
    ), true);
    assert.equal(canAccessProject(
      contributorContext!.membership, contributorContext!.assignment,
      { projectId, workerId: managerId }, "approve_time",
    ), false);

    let tick = Date.parse("2026-11-09T12:00:00.000Z");
    const now = () => new Date(tick += 1000);
    const call = (path: string, method = "GET", body?: Record<string, unknown>, subject = contributorId) =>
      handleWorkspaceRequest(request(path, method, body, subject), { workspaceStore: store, now });
    const projectPath = `/projects/${projectId}`;
    const entryPath = `${projectPath}/time-entries`;
    const draftInput = parseTimeSubmission({
      projectId, taskId: contributorTaskId, workDate: "2026-11-08", minutes: 45,
      description: "Initial implementation review",
    });
    assert.ok(draftInput);
    const draftResponse = await call(entryPath, "POST", {
      taskId: draftInput.taskId, workDate: draftInput.workDate,
      minutes: draftInput.minutes, description: draftInput.description,
    });
    assert.equal(draftResponse?.statusCode, 201);
    let entry = parseEntry(draftResponse?.body);
    assert.equal(entry.status, "DRAFT");
    assert.equal(entry.version, 0);

    const correctionBody = parseTimeDraftUpdate({
      taskId: contributorTaskId, workDate: "2026-11-09", minutes: 60,
      description: "Updated implementation review", expectedVersion: entry.version,
    });
    assert.ok(correctionBody);
    const correctedDraft = await call(
      `${entryPath}/${entry.timeEntryId}`, "PATCH", correctionBody,
    );
    assert.equal(correctedDraft?.statusCode, 200);
    entry = parseEntry(correctedDraft?.body);
    assert.equal(entry.status, "DRAFT");
    assert.equal(entry.version, 1);
    assert.equal(entry.workDate, "2026-11-09");

    const firstSubmission = await call(
      `${entryPath}/${entry.timeEntryId}/submit`, "POST", { expectedVersion: entry.version },
    );
    assert.equal(firstSubmission?.statusCode, 200);
    entry = parseEntry(firstSubmission?.body);
    assert.equal(entry.status, "SUBMITTED");
    assert.equal(entry.version, 2);

    const reviewPath = `${entryPath}/${entry.timeEntryId}/review`;
    const rejection = parseTimeReview({
      decision: "REJECTED", expectedVersion: entry.version, note: "Clarify the reviewed deliverable.",
    });
    assert.ok(rejection);
    const rejected = await call(reviewPath, "POST", rejection, managerId);
    assert.equal(rejected?.statusCode, 200);
    entry = parseEntry(rejected?.body);
    assert.equal(entry.status, "REJECTED");
    assert.equal(entry.version, 3);
    assert.equal(entry.reviewDecision, "REJECTED");
    assert.equal(entry.reviewNote, "Clarify the reviewed deliverable.");
    assert.equal((await store.getTimeEntry(projectId, entry.timeEntryId))?.status, "REJECTED");

    const staleCorrection = await call(`${entryPath}/${entry.timeEntryId}`, "PATCH", {
      ...correctionBody, expectedVersion: 2,
    });
    assert.equal(staleCorrection?.statusCode, 409);
    assert.equal((await store.getTimeEntry(projectId, entry.timeEntryId))?.version, 3);

    const ownerCorrection = parseTimeDraftUpdate({
      taskId: contributorTaskId, workDate: "2026-11-09", minutes: 75,
      description: "Clarified deliverable and outcome", expectedVersion: entry.version,
    });
    assert.ok(ownerCorrection);
    const correctedRejected = await call(
      `${entryPath}/${entry.timeEntryId}`, "PATCH", ownerCorrection,
    );
    assert.equal(correctedRejected?.statusCode, 200);
    entry = parseEntry(correctedRejected?.body);
    assert.equal(entry.status, "DRAFT");
    assert.equal(entry.version, 4);
    assert.equal(entry.reviewedAt, undefined);
    assert.equal(entry.reviewedBy, undefined);
    assert.equal(entry.reviewDecision, undefined);
    assert.equal(entry.reviewNote, undefined);
    const storedCorrection = await document.send(new GetCommand({
      TableName: tableName, Key: { PK: `PROJECT#${projectId}`, SK: `TIME#${entry.timeEntryId}` },
      ConsistentRead: true,
    }));
    for (const field of ["submittedAt", "reviewedAt", "reviewedBy", "reviewDecision", "reviewNote", "GSI2PK", "GSI2SK"]) {
      assert.equal(storedCorrection.Item?.[field], undefined, `correction must remove ${field}`);
    }

    const ownerEntries = await store.listMyTimeEntries(contributorId);
    assert.equal(ownerEntries.items.find((item) => item.timeEntryId === entry.timeEntryId)?.workDate, "2026-11-09");
    const secondSubmission = await call(
      `${entryPath}/${entry.timeEntryId}/submit`, "POST", { expectedVersion: entry.version },
    );
    assert.equal(secondSubmission?.statusCode, 200);
    entry = parseEntry(secondSubmission?.body);
    assert.equal(entry.status, "SUBMITTED");
    assert.equal(entry.version, 5);

    const approval = parseTimeReview({
      decision: "APPROVED", expectedVersion: entry.version, note: "Accepted after clarification.",
    });
    assert.ok(approval);
    const approved = await call(reviewPath, "POST", approval, managerId);
    assert.equal(approved?.statusCode, 200);
    entry = parseEntry(approved?.body);
    assert.equal(entry.status, "APPROVED");
    assert.equal(entry.version, 6);
    assert.equal(entry.reviewDecision, "APPROVED");
    assert.equal(entry.reviewNote, "Accepted after clarification.");

    const managerDraftInput = parseTimeSubmission({
      projectId, taskId: managerTaskId, workDate: "2026-11-09", minutes: 30,
      description: "Manager's own review work",
    });
    assert.ok(managerDraftInput);
    const managerDraftResponse = await call(entryPath, "POST", {
      taskId: managerDraftInput.taskId, workDate: managerDraftInput.workDate,
      minutes: managerDraftInput.minutes, description: managerDraftInput.description,
    }, managerId);
    assert.equal(managerDraftResponse?.statusCode, 201);
    const managerDraft = parseEntry(managerDraftResponse?.body);
    const managerSubmission = await call(
      `${entryPath}/${managerDraft.timeEntryId}/submit`, "POST", { expectedVersion: 0 }, managerId,
    );
    assert.equal(managerSubmission?.statusCode, 200);
    const selfReview = await call(
      `${entryPath}/${managerDraft.timeEntryId}/review`, "POST",
      { decision: "APPROVED", expectedVersion: 1 }, managerId,
    );
    assert.equal(selfReview?.statusCode, 403);
    assert.equal((await store.getTimeEntry(projectId, managerDraft.timeEntryId))?.status, "SUBMITTED");

    const unassignedTasks = await call(`${projectPath}/tasks`, "GET", undefined, unassignedId);
    assert.equal(unassignedTasks?.statusCode, 403);
    const unassignedTime = await call(entryPath, "POST", {
      taskId: contributorTaskId, workDate: "2026-11-09", minutes: 15, description: "Out of scope",
    }, unassignedId);
    assert.equal(unassignedTime?.statusCode, 403);

    await t.test("all seven contributor transitions remain in immutable audit history", async () => {
      const audit = await document.send(new QueryCommand({
        TableName: tableName,
        KeyConditionExpression: "PK = :project AND begins_with(SK, :auditPrefix)",
        ExpressionAttributeValues: {
          ":project": `PROJECT#${projectId}`, ":auditPrefix": "AUDIT#",
        },
        ConsistentRead: true,
      }));
      const entryAudit = (audit.Items ?? []).filter((item) => item.entityId === entry.timeEntryId);
      assert.deepEqual(entryAudit.map((item) => item.action), [
        "TIME_DRAFT_CREATED", "TIME_DRAFT_CORRECTED", "TIME_SUBMITTED",
        "TIME_REJECTED", "TIME_DRAFT_CORRECTED", "TIME_SUBMITTED", "TIME_APPROVED",
      ]);
      assert.deepEqual(entryAudit.map((item) => [item.fromVersion, item.toVersion]), [
        [0, 0], [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6],
      ]);
      assert.equal(new Set(entryAudit.map((item) => item.SK)).size, 7);
    });

    await t.test("workspace writes create no reporting outbox records", async () => {
      const outbox = await document.send(new QueryCommand({
        TableName: tableName,
        KeyConditionExpression: "PK = :project AND begins_with(SK, :outboxPrefix)",
        ExpressionAttributeValues: {
          ":project": `PROJECT#${projectId}`, ":outboxPrefix": "OUTBOX#",
        },
        ConsistentRead: true,
      }));
      assert.equal(outbox.Items?.length ?? 0, 0);
    });

    const managerQueue = await store.listPendingTime(managerContext!);
    assert.deepEqual(managerQueue.items.map((item) => item.timeEntryId), [managerDraft.timeEntryId]);
  } finally {
    try {
      if (created) await client.send(new DeleteTableCommand({ TableName: tableName }));
    } finally {
      client.destroy();
    }
  }
});
