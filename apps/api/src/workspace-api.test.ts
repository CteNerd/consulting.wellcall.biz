import assert from "node:assert/strict";
import { test } from "node:test";
import { handleWorkspaceRequest } from "./workspace-api.ts";
import type { Request } from "./handler.ts";
import { WorkspaceConflictError, type ProjectContext, type WorkspaceStore } from "./workspace-store.ts";

const projectId = "b9de9897-5f48-4a63-a872-1d1b53bd64a5";
const taskId = "e8de9897-5f48-4a63-a872-1d1b53bd64a5";
const timeId = "c9de9897-5f48-4a63-a872-1d1b53bd64a5";
const contributorContext: ProjectContext = {
  membership: { userId: "member-1", active: true, financeAccess: false },
  assignment: { userId: "member-1", projectId, active: true, role: "contributor" },
  project: { projectId, name: "Assigned project", status: "ACTIVE" },
};

function request(path: string, method = "GET", body?: unknown, subject = "member-1"): Request {
  return {
    version: "2.0", routeKey: `${method} ${path}`, rawPath: path, rawQueryString: "",
    headers: body === undefined ? {} : { "content-type": "application/json" },
    isBase64Encoded: false,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    requestContext: {
      accountId: "123456789012", apiId: "test", domainName: "api.example.invalid",
      domainPrefix: "api", requestId: "request-1", routeKey: `${method} ${path}`,
      stage: "$default", time: "2026-11-08T00:00:00Z", timeEpoch: 0,
      http: { method, path, protocol: "HTTP/1.1", sourceIp: "127.0.0.1", userAgent: "test" },
      authorizer: { jwt: { claims: { sub: subject, "cognito:groups": ["ConsultingAdministrators"] } } },
    },
  };
}

test("every project route requires active app membership and an active matching assignment", async () => {
  let taskReads = 0;
  const store = {
    getContext: async () => ({
      ...contributorContext, membership: { ...contributorContext.membership, active: false },
    }),
    listTasks: async () => { taskReads += 1; return { items: [], nextToken: null }; },
  } as unknown as WorkspaceStore;
  const result = await handleWorkspaceRequest(request(`/projects/${projectId}/tasks`), { workspaceStore: store });
  assert.equal(result?.statusCode, 403);
  assert.equal(taskReads, 0);

  const noAssignmentStore = {
    getContext: async () => null,
    listTasks: async () => { taskReads += 1; return { items: [], nextToken: null }; },
  } as unknown as WorkspaceStore;
  const missingAssignment = await handleWorkspaceRequest(
    request(`/projects/${projectId}/tasks`), { workspaceStore: noAssignmentStore },
  );
  assert.equal(missingAssignment?.statusCode, 403);
  assert.equal(taskReads, 0);
});

test("time draft creation enforces task ownership and handles asynchronous storage failures", async (t) => {
  let writes = 0;
  const store = {
    getContext: async () => contributorContext,
    getTask: async () => ({
      projectId, taskId, title: "Assigned task", description: "", assignedToUserId: "other-member",
      status: "TODO", version: 0, createdAt: "2026-11-08T00:00:00.000Z",
      updatedAt: "2026-11-08T00:00:00.000Z",
    }),
    createTimeEntry: async () => { writes += 1; throw new Error("must not write"); },
  } as unknown as WorkspaceStore;
  const result = await handleWorkspaceRequest(request(`/projects/${projectId}/time-entries`, "POST", {
    taskId, workDate: "2026-11-08", minutes: 45, description: "Implementation",
  }), { workspaceStore: store });
  assert.equal(result?.statusCode, 403);
  assert.equal(writes, 0);

  const forged = await handleWorkspaceRequest(request(`/projects/${projectId}/time-entries`, "POST", {
    taskId, workDate: "2026-11-08", minutes: 45, description: "Implementation", workerId: "other-member",
  }), { workspaceStore: store });
  assert.equal(forged?.statusCode, 400);

  store.getTask = async () => ({
    projectId, taskId, title: "Assigned task", description: "", assignedToUserId: "member-1",
    status: "TODO", version: 0, createdAt: "2026-11-08T00:00:00.000Z",
    updatedAt: "2026-11-08T00:00:00.000Z",
  });
  const logged = t.mock.method(console, "error", () => {});
  for (const [error, statusCode] of [
    [new WorkspaceConflictError(), 409],
    [new Error("private storage details"), 500],
  ] as const) {
    store.createTimeEntry = async () => { writes += 1; throw error; };
    const failed = await handleWorkspaceRequest(request(`/projects/${projectId}/time-entries`, "POST", {
      taskId, workDate: "2026-11-08", minutes: 45, description: "Implementation",
    }), { workspaceStore: store });
    assert.equal(failed?.statusCode, statusCode);
    assert.doesNotMatch(failed!.body!, /private storage details/);
  }
  assert.equal(writes, 2);
  assert.equal(logged.mock.callCount(), 1);
});

test("only an assigned manager can create a task for an active project assignee", async () => {
  let writes = 0;
  const managerContext: ProjectContext = {
    ...contributorContext, assignment: { ...contributorContext.assignment, role: "manager" },
  };
  const targetContext: ProjectContext = {
    ...contributorContext,
    membership: { ...contributorContext.membership, userId: "member-2" },
    assignment: { ...contributorContext.assignment, userId: "member-2" },
  };
  const store = {
    getContext: async (userId: string) => userId === "manager-1" ? managerContext : targetContext,
    createTask: async (_context: ProjectContext, actorId: string, input: { assignedToUserId: string }) => {
      writes += 1;
      assert.equal(actorId, "manager-1");
      assert.equal(input.assignedToUserId, "member-2");
      return {
        projectId, taskId, title: "Assigned task", description: "", assignedToUserId: "member-2",
        status: "TODO", version: 0, createdAt: "2026-11-08T00:00:00.000Z",
        updatedAt: "2026-11-08T00:00:00.000Z",
      };
    },
  } as unknown as WorkspaceStore;
  const denied = await handleWorkspaceRequest(request(`/projects/${projectId}/tasks`, "POST", {
    title: "Assigned task", description: "", assignedToUserId: "member-2",
  }), { workspaceStore: { ...store, getContext: async () => contributorContext } as WorkspaceStore });
  assert.equal(denied?.statusCode, 403);
  assert.equal(writes, 0);

  const created = await handleWorkspaceRequest(request(`/projects/${projectId}/tasks`, "POST", {
    title: "Assigned task", description: "", assignedToUserId: "member-2",
  }, "manager-1"), { workspaceStore: store });
  assert.equal(created?.statusCode, 201);
  assert.equal(writes, 1);
});

test("assignment roster is manager-only even when the caller has an administrator Cognito group", async () => {
  let rosterReads = 0;
  const store = {
    getContext: async () => contributorContext,
    listAssignments: async () => {
      rosterReads += 1;
      return { items: [], nextToken: null };
    },
  } as unknown as WorkspaceStore;
  const result = await handleWorkspaceRequest(request(`/projects/${projectId}/assignments`), {
    workspaceStore: store,
  });
  assert.equal(result?.statusCode, 403);
  assert.equal(rosterReads, 0);
});

test("the API rejects self-assignment before starting a duplicate-key assignment transaction", async () => {
  let writes = 0;
  const managerContext: ProjectContext = {
    ...contributorContext, assignment: { ...contributorContext.assignment, role: "manager" },
  };
  const store = {
    getContext: async () => managerContext,
    getMembership: async () => managerContext.membership,
    createAssignment: async () => { writes += 1; throw new Error("must not write"); },
  } as unknown as WorkspaceStore;
  const result = await handleWorkspaceRequest(request(
    `/projects/${projectId}/assignments`, "POST", { userId: "member-1", role: "contributor" }, "member-1",
  ), { workspaceStore: store });
  assert.equal(result?.statusCode, 400);
  assert.equal(writes, 0);
});

test("manager review rejects self-approval but permits a submitted peer entry", async () => {
  let reviews = 0;
  let reviewWorker: string | undefined;
  const managerContext: ProjectContext = {
    ...contributorContext, assignment: { ...contributorContext.assignment, role: "manager" },
  };
  const store = {
    getContext: async () => managerContext,
    getTimeEntry: async (_projectId: string, id: string) => ({
      projectId, timeEntryId: id, taskId, workerId: id === timeId ? "member-2" : "member-1",
      workDate: "2026-11-08", minutes: 60, description: "Work", status: "SUBMITTED", version: 1,
      createdAt: "2026-11-08T00:00:00.000Z", submittedAt: "2026-11-08T01:00:00.000Z",
    }),
    reviewTimeEntry: async (_context: ProjectContext, _actor: string, entry: { workerId: string }) => {
      reviews += 1;
      reviewWorker = entry.workerId;
      return { ...entry, status: "APPROVED", version: 2 };
    },
  } as unknown as WorkspaceStore;
  const own = await handleWorkspaceRequest(request(
    `/projects/${projectId}/time-entries/${"d9de9897-5f48-4a63-a872-1d1b53bd64a5"}/review`,
    "POST", { decision: "APPROVED", expectedVersion: 1 },
  ), { workspaceStore: store });
  assert.equal(own?.statusCode, 403);
  assert.equal(reviews, 0);

  const peer = await handleWorkspaceRequest(request(
    `/projects/${projectId}/time-entries/${timeId}/review`,
    "POST", { decision: "APPROVED", expectedVersion: 1 },
  ), { workspaceStore: store });
  assert.equal(peer?.statusCode, 200);
  assert.equal(reviewWorker, "member-2");
  assert.equal(reviews, 1);
});

test("review requires a manager assignment and endpoint claims cannot grant project-admin rights", async () => {
  let entryReads = 0;
  const store = {
    getContext: async () => contributorContext,
    getTimeEntry: async () => { entryReads += 1; throw new Error("must not read"); },
  } as unknown as WorkspaceStore;
  const result = await handleWorkspaceRequest(request(
    `/projects/${projectId}/time-entries/${timeId}/review`,
    "POST", { decision: "APPROVED", expectedVersion: 1 },
  ), { workspaceStore: store });
  assert.equal(result?.statusCode, 403);
  assert.equal(entryReads, 0);
});

test("time submission uses a strict versioned body and returns conflicts without retry", async () => {
  let submits = 0;
  const draft = {
    projectId, timeEntryId: timeId, taskId, workerId: "member-1",
    workDate: "2026-11-08", minutes: 30, description: "Work", status: "DRAFT", version: 0,
    createdAt: "2026-11-08T00:00:00.000Z",
  };
  const store = {
    getContext: async () => contributorContext,
    getTimeEntry: async () => draft,
    submitTimeEntry: async () => { submits += 1; return { ...draft, status: "SUBMITTED", version: 1 }; },
  } as unknown as WorkspaceStore;
  const stale = await handleWorkspaceRequest(request(
    `/projects/${projectId}/time-entries/${timeId}/submit`, "POST", { expectedVersion: 1 },
  ), { workspaceStore: store });
  assert.equal(stale?.statusCode, 409);
  assert.equal(submits, 0);

  const submitted = await handleWorkspaceRequest(request(
    `/projects/${projectId}/time-entries/${timeId}/submit`, "POST", { expectedVersion: 0 },
  ), { workspaceStore: store });
  assert.equal(submitted?.statusCode, 200);
  assert.equal(submits, 1);
});

test("only the owner can correct draft or rejected time; terminal statuses and stale versions conflict", async () => {
  const correction = {
    taskId, workDate: "2026-11-08", minutes: 45, description: "Clarified work", expectedVersion: 3,
  };
  let taskReads = 0;
  let writes = 0;
  const entry = {
    projectId, timeEntryId: timeId, taskId, workerId: "member-1",
    workDate: "2026-11-07", minutes: 30, description: "Work", status: "REJECTED", version: 3,
    createdAt: "2026-11-07T00:00:00.000Z",
  };
  const store = {
    getContext: async () => contributorContext,
    getTimeEntry: async () => entry,
    getTask: async () => {
      taskReads += 1;
      return { projectId, taskId, title: "Assigned", description: "", assignedToUserId: "member-1", status: "TODO", version: 0 };
    },
    updateTimeDraft: async (_context: ProjectContext, actor: string, current: typeof entry, update: typeof correction) => {
      writes += 1;
      assert.equal(actor, "member-1");
      assert.equal(current.timeEntryId, timeId);
      assert.equal(update.expectedVersion, 3);
      return { ...current, ...update, status: "DRAFT", version: 4 };
    },
  } as unknown as WorkspaceStore;

  const otherOwner = await handleWorkspaceRequest(request(
    `/projects/${projectId}/time-entries/${timeId}`, "PATCH", correction, "member-2",
  ), { workspaceStore: { ...store, getContext: async () => ({
    ...contributorContext,
    membership: { ...contributorContext.membership, userId: "member-2" },
    assignment: { ...contributorContext.assignment, userId: "member-2" },
  }), getTimeEntry: async () => ({ ...entry, workerId: "member-1" }) } as WorkspaceStore });
  assert.equal(otherOwner?.statusCode, 404);
  assert.equal(taskReads, 0);
  assert.equal(writes, 0);

  const corrected = await handleWorkspaceRequest(request(
    `/projects/${projectId}/time-entries/${timeId}`, "PATCH", correction,
  ), { workspaceStore: store });
  assert.equal(corrected?.statusCode, 200);
  assert.deepEqual(JSON.parse(corrected!.body!), {
    ...entry, ...correction, status: "DRAFT", version: 4,
  });
  assert.equal(taskReads, 1);
  assert.equal(writes, 1);

  for (const status of ["SUBMITTED", "APPROVED", "REJECTED"] as const) {
    const response = await handleWorkspaceRequest(request(
      `/projects/${projectId}/time-entries/${timeId}`, "PATCH",
      { ...correction, expectedVersion: status === "REJECTED" ? 2 : 3 },
    ), { workspaceStore: {
      ...store,
      getTimeEntry: async () => ({ ...entry, status }),
    } as WorkspaceStore });
    assert.equal(response?.statusCode, 409);
  }
  assert.equal(writes, 1);
});

test("correction requires current app membership and project/task assignments", async () => {
  const entry = {
    projectId, timeEntryId: timeId, taskId, workerId: "member-1",
    workDate: "2026-11-08", minutes: 30, description: "Work", status: "DRAFT", version: 0,
    createdAt: "2026-11-08T00:00:00.000Z",
  };
  let writes = 0;
  const body = { taskId, workDate: "2026-11-08", minutes: 30, description: "Work", expectedVersion: 0 };
  for (const context of [
    { ...contributorContext, membership: { ...contributorContext.membership, active: false } },
    { ...contributorContext, assignment: { ...contributorContext.assignment, active: false } },
  ]) {
    const denied = await handleWorkspaceRequest(request(
      `/projects/${projectId}/time-entries/${timeId}`, "PATCH", body,
    ), { workspaceStore: { getContext: async () => context } as unknown as WorkspaceStore });
    assert.equal(denied?.statusCode, 403);
  }
  const unassignedTask = await handleWorkspaceRequest(request(
    `/projects/${projectId}/time-entries/${timeId}`, "PATCH", body,
  ), { workspaceStore: {
    getContext: async () => contributorContext,
    getTimeEntry: async () => entry,
    getTask: async () => ({
      projectId, taskId, title: "Task", description: "", assignedToUserId: "member-2",
      status: "TODO", version: 0,
    }),
    updateTimeDraft: async () => { writes += 1; throw new Error("must not write"); },
  } as unknown as WorkspaceStore });
  assert.equal(unassignedTask?.statusCode, 403);
  assert.equal(writes, 0);
});

test("conditional correction conflicts are surfaced once without retry", async () => {
  let writes = 0;
  const store = {
    getContext: async () => contributorContext,
    getTimeEntry: async () => ({
      projectId, timeEntryId: timeId, taskId, workerId: "member-1",
      workDate: "2026-11-08", minutes: 30, description: "Work", status: "DRAFT", version: 0,
      createdAt: "2026-11-08T00:00:00.000Z",
    }),
    getTask: async () => ({
      projectId, taskId, title: "Task", description: "", assignedToUserId: "member-1", status: "TODO", version: 0,
    }),
    updateTimeDraft: async () => { writes += 1; throw new WorkspaceConflictError(); },
  } as unknown as WorkspaceStore;
  const result = await handleWorkspaceRequest(request(
    `/projects/${projectId}/time-entries/${timeId}`, "PATCH",
    { taskId, workDate: "2026-11-08", minutes: 30, description: "Work", expectedVersion: 0 },
  ), { workspaceStore: store });
  assert.equal(result?.statusCode, 409);
  assert.equal(writes, 1);
});
