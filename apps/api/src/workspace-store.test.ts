import assert from "node:assert/strict";
import { test } from "node:test";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import type { ProjectContext } from "./workspace-store.ts";
import { DynamoWorkspaceStore } from "./workspace-store.ts";

const projectId = "b9de9897-5f48-4a63-a872-1d1b53bd64a5";
const taskId = "e8de9897-5f48-4a63-a872-1d1b53bd64a5";
const timeEntryId = "c9de9897-5f48-4a63-a872-1d1b53bd64a5";
const manager: ProjectContext = {
  membership: { userId: "manager-1", active: true, financeAccess: false },
  assignment: { userId: "manager-1", projectId, active: true, role: "manager" },
  project: { projectId, name: "Assigned project", status: "ACTIVE" },
};
const contributor: ProjectContext = {
  membership: { userId: "worker-1", active: true, financeAccess: false },
  assignment: { userId: "worker-1", projectId, active: true, role: "contributor" },
  project: manager.project,
};

function fakeClient() {
  const commands: Array<Record<string, unknown>> = [];
  const client = {
    send: async (command: { input: unknown }) => {
      commands.push(command.input as Record<string, unknown>);
      return {};
    },
  } as unknown as DynamoDBDocumentClient;
  return { client, commands };
}

function transaction(commands: Array<Record<string, unknown>>): Record<string, unknown>[] {
  assert.equal(commands.length, 1);
  const input = commands[0]!;
  assert.ok(Array.isArray(input.TransactItems));
  return input.TransactItems as Record<string, unknown>[];
}

test("task assignment creation atomically checks both app memberships and active project assignments", async () => {
  const { client, commands } = fakeClient();
  const store = new DynamoWorkspaceStore(client, "core");
  await store.createTask(manager, "manager-1", {
    title: "Build API", description: "Scope", assignedToUserId: "worker-1",
  }, new Date("2026-11-08T12:00:00.000Z"), taskId);
  const items = transaction(commands);
  const conditions = items.flatMap((item) => item.ConditionCheck ? [item.ConditionCheck as Record<string, unknown>] : []);
  const conditionKeys = conditions.map((condition) => JSON.stringify(condition.Key));
  assert.deepEqual(conditionKeys.sort(), [
    '{"PK":"PROJECT#b9de9897-5f48-4a63-a872-1d1b53bd64a5","SK":"ASSIGNMENT#manager-1"}',
    '{"PK":"PROJECT#b9de9897-5f48-4a63-a872-1d1b53bd64a5","SK":"ASSIGNMENT#worker-1"}',
    '{"PK":"PROJECT#b9de9897-5f48-4a63-a872-1d1b53bd64a5","SK":"METADATA"}',
    '{"PK":"USER#manager-1","SK":"MEMBERSHIP"}',
    '{"PK":"USER#worker-1","SK":"MEMBERSHIP"}',
  ]);
  assert.ok(conditions.some((item) =>
    item.ConditionExpression === "#recordType = :assignment AND #active = :active AND #role = :manager"));
  const puts = items.flatMap((item) => item.Put ? [item.Put as Record<string, unknown>] : []);
  const taskPut = puts.find((put) => (put.Item as Record<string, unknown>).recordType === "TASK");
  const auditPut = puts.find((put) => (put.Item as Record<string, unknown>).recordType === "AUDIT");
  assert.ok(taskPut);
  assert.ok(auditPut);
  const item = taskPut.Item as Record<string, unknown>;
  assert.equal(item.assignedToUserId, "worker-1");
  assert.equal(item.status, "TODO");
  assert.equal(item.version, 0);
  assert.equal(item.GSI3PK, "USER#worker-1");
  assert.equal("rate" in item || "amount" in item, false);
});

test("manager and app-admin self-assigned tasks deduplicate every transaction item by table and key", async () => {
  const cases: Array<{ userId: string; context: ProjectContext }> = [
    { userId: "manager-1", context: manager },
    {
      userId: "admin-1",
      context: {
        membership: { userId: "admin-1", active: true, financeAccess: false, projectAdmin: true },
        assignment: { userId: "admin-1", projectId, active: true, role: "contributor" },
        project: manager.project,
      },
    },
  ];

  for (const { userId, context } of cases) {
    const { client, commands } = fakeClient();
    const store = new DynamoWorkspaceStore(client, "core");
    await store.createTask(context, userId, {
      title: "My task", description: "", assignedToUserId: userId,
    }, new Date("2026-11-08T12:00:00.000Z"), taskId);
    const items = transaction(commands);
    const addressedItems = items.map((item) => {
      const operation = Object.keys(item)[0]!;
      const payload = item[operation] as Record<string, unknown>;
      const key = (operation === "Put" ? payload.Item : payload.Key) as Record<string, string>;
      return `${payload.TableName}:${key.PK}:${key.SK}`;
    });
    assert.equal(new Set(addressedItems).size, addressedItems.length, `${userId} transaction repeats an item`);
    const checks = items.flatMap((item) => item.ConditionCheck
      ? [item.ConditionCheck as Record<string, unknown>]
      : []);
    assert.deepEqual(checks.map((check) => check.Key).sort((a, b) =>
      String(JSON.stringify(a)).localeCompare(String(JSON.stringify(b)))), [
      { PK: `PROJECT#${projectId}`, SK: `ASSIGNMENT#${userId}` },
      { PK: `PROJECT#${projectId}`, SK: "METADATA" },
      { PK: `USER#${userId}`, SK: "MEMBERSHIP" },
    ]);
  }
});

test("contributor task listing is bounded and filters to the caller's assigned tasks", async () => {
  const commands: Array<Record<string, unknown>> = [];
  const client = {
    send: async (command: { input: unknown }) => {
      const input = command.input as Record<string, unknown>;
      commands.push(input);
      return {
        Items: [
          {
            recordType: "TASK", projectId, taskId, title: "Own task", description: "",
            assignedToUserId: "worker-1", status: "TODO", version: 0,
            createdAt: "2026-11-08T12:00:00.000Z", updatedAt: "2026-11-08T12:00:00.000Z",
          },
          {
            recordType: "TASK", projectId, taskId: "d9de9897-5f48-4a63-a872-1d1b53bd64a5",
            title: "Other task", description: "", assignedToUserId: "worker-2", status: "TODO", version: 0,
            createdAt: "2026-11-08T12:00:00.000Z", updatedAt: "2026-11-08T12:00:00.000Z",
          },
        ],
      };
    },
  } as unknown as DynamoDBDocumentClient;
  const store = new DynamoWorkspaceStore(client, "core");
  const page = await store.listTasks("worker-1", contributor);
  assert.equal(commands[0]?.IndexName, "WorkspaceIndex");
  assert.equal(commands[0]?.Limit, 50);
  assert.deepEqual(commands[0]?.ExpressionAttributeValues, {
    ":user": "USER#worker-1", ":taskPrefix": `TASK#${projectId}#`,
  });
  assert.deepEqual(page.items.map((task) => task.taskId), [taskId]);
  assert.equal(page.nextToken, null);
});

test("time submission atomically checks the caller, active assignment, task ownership, and expected draft version", async () => {
  const { client, commands } = fakeClient();
  const store = new DynamoWorkspaceStore(client, "core");
  const entry = {
    projectId, timeEntryId, taskId, workerId: "worker-1", workDate: "2026-11-08",
    minutes: 45, description: "Implementation", status: "DRAFT" as const, version: 0,
    createdAt: "2026-11-08T12:00:00.000Z",
  };
  await store.submitTimeEntry(contributor, "worker-1", entry, 0, new Date("2026-11-08T13:00:00.000Z"));
  const items = transaction(commands);
  const conditions = items.flatMap((item) => item.ConditionCheck ? [item.ConditionCheck as Record<string, unknown>] : []);
  assert.deepEqual(conditions.map((condition) => condition.Key).sort((a, b) =>
    JSON.stringify(a).localeCompare(JSON.stringify(b))), [
    { PK: `PROJECT#${projectId}`, SK: "ASSIGNMENT#worker-1" },
    { PK: "USER#worker-1", SK: "MEMBERSHIP" },
  ]);
  const update = items.find((item) => item.Update)?.Update as Record<string, unknown>;
  assert.match(String(update.ConditionExpression), /#worker = :actor/);
  assert.match(String(update.ConditionExpression), /#status = :draft/);
  assert.match(String(update.ConditionExpression), /#version = :expectedVersion/);
  assert.deepEqual(update.ExpressionAttributeValues, {
    ":entry": "TIME_ENTRY", ":actor": "worker-1", ":draft": "DRAFT", ":submitted": "SUBMITTED",
    ":expectedVersion": 0, ":nextVersion": 1, ":submittedAt": "2026-11-08T13:00:00.000Z",
    ":pendingKey": `PROJECT#${projectId}#PENDING_TIME`,
    ":pendingSortKey": `2026-11-08T13:00:00.000Z#${timeEntryId}`,
  });
  assert.equal(items.filter((item) => item.Put).length, 1);
});

test("manager review is versioned, excludes self-approval in storage, and removes only pending-review keys", async () => {
  const { client, commands } = fakeClient();
  const store = new DynamoWorkspaceStore(client, "core");
  const entry = {
    projectId, timeEntryId, taskId, workerId: "worker-2", workDate: "2026-11-08",
    minutes: 60, description: "Reviewable work", status: "SUBMITTED" as const, version: 1,
    createdAt: "2026-11-08T12:00:00.000Z", submittedAt: "2026-11-08T13:00:00.000Z",
  };
  await store.reviewTimeEntry(manager, "manager-1", entry, {
    decision: "APPROVED", expectedVersion: 1, note: "Accepted",
  }, new Date("2026-11-08T14:00:00.000Z"));
  const items = transaction(commands);
  const conditions = items.flatMap((item) => item.ConditionCheck ? [item.ConditionCheck as Record<string, unknown>] : []);
  assert.ok(conditions.some((condition) =>
    condition.ConditionExpression === "#recordType = :assignment AND #active = :active AND #role = :manager"));
  assert.ok(conditions.some((condition) =>
    condition.ConditionExpression === "#recordType = :membership AND #active = :active"));
  const update = items.find((item) => item.Update)?.Update as Record<string, unknown>;
  assert.match(String(update.ConditionExpression), /#worker <> :actor/);
  assert.match(String(update.ConditionExpression), /#status = :submitted/);
  assert.match(String(update.ConditionExpression), /#version = :expectedVersion/);
  assert.match(String(update.UpdateExpression), /REMOVE GSI2PK, GSI2SK/);
  assert.deepEqual(update.ExpressionAttributeValues, {
    ":entry": "TIME_ENTRY", ":actor": "manager-1", ":submitted": "SUBMITTED", ":decision": "APPROVED",
    ":expectedVersion": 1, ":nextVersion": 2, ":reviewedAt": "2026-11-08T14:00:00.000Z", ":note": "Accepted",
  });
});
