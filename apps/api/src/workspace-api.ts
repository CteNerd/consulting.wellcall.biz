import { randomUUID } from "node:crypto";
import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { canAccessProject } from "../../../packages/domain/src/authorization.ts";
import {
  canTransitionTask, isPrincipalId, isProjectId, isProjectManager, parseCreateAssignment, parseCreateTask,
  parseTaskUpdate, parseTimeDraftUpdate, parseTimeReview, parseTimeSubmission,
} from "../../../packages/domain/src/workspace.ts";
import type { Request } from "./handler.ts";
import {
  InvalidWorkspaceCursorError, WorkspaceConflictError,
  type ProjectContext, type WorkspaceStore,
} from "./workspace-store.ts";

type WorkspaceHandlerDependencies = {
  workspaceStore?: WorkspaceStore;
  now?: () => Date;
  newId?: () => string;
};

const routeId = "([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})";

function response(statusCode: number, body: object): APIGatewayProxyStructuredResultV2 {
  return {
    statusCode,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
    body: JSON.stringify(body),
  };
}

export async function handleWorkspaceRequest(
  event: Request, dependencies: WorkspaceHandlerDependencies,
): Promise<APIGatewayProxyStructuredResultV2 | undefined> {
  const method = event.requestContext.http.method;
  const path = event.rawPath;
  const projectSubroute = new RegExp(
    `^/projects/${routeId}/(?:assignments|tasks|pending-time|time-entries(?:/${routeId}(?:/(?:submit|review))?)?)$`,
  );
  const taskRoute = new RegExp(`^/projects/${routeId}/tasks/${routeId}$`);
  const matched = method === "GET" && path === "/projects"
    || method === "GET" && path === "/my/time-entries"
    || projectSubroute.test(path)
    || taskRoute.test(path);

  if (!matched) return undefined;
  const store = dependencies.workspaceStore;
  if (!store) return response(503, { error: "Project workspace is not available" });
  const actorId = authenticatedSubject(event);
  if (!actorId) return response(401, { error: "Authentication required" });
  const nextToken = event.queryStringParameters?.nextToken;
  if (nextToken !== undefined && nextToken.length > 2048) return response(400, { error: "Invalid page token" });

  try {
    if (method === "GET" && path === "/projects") {
      const membership = await store.getMembership(actorId);
      if (!membership?.active) return response(403, { error: "Active Consulting membership required" });
      const page = await store.listProjects(actorId, nextToken);
      return response(200, { projects: page.items, nextToken: page.nextToken });
    }
    if (method === "GET" && path === "/my/time-entries") {
      return await listOwnTimeEntries(event, store, actorId, nextToken);
    }

    const projectMatch = new RegExp(`^/projects/${routeId}/(.*)$`).exec(path);
    if (!projectMatch || !isProjectId(projectMatch[1])) return response(400, { error: "Invalid project ID" });
    const projectId = projectMatch[1];
    const context = await store.getContext(actorId, projectId);
    if (!context || !canAccessProject(
      context.membership, context.assignment, { projectId }, "read",
    )) return response(403, { error: "Active project assignment required" });
    const suffix = projectMatch[2]!;

    if (method === "GET" && suffix === "tasks") {
      const page = await store.listTasks(actorId, context, nextToken);
      return response(200, { tasks: page.items, nextToken: page.nextToken });
    }
    if (method === "GET" && suffix === "assignments") {
      if (!isProjectManager(context.membership, context.assignment)) {
        return response(403, { error: "Project manager access required" });
      }
      const page = await store.listAssignments(context, nextToken);
      return response(200, { assignments: page.items, nextToken: page.nextToken });
    }
    if (method === "POST" && suffix === "assignments") {
      return await createAssignment(event, store, context, actorId, dependencies);
    }
    if (method === "POST" && suffix === "tasks") {
      return await createTask(event, store, context, actorId, dependencies);
    }
    if (method === "GET" && suffix === "pending-time") {
      if (!isProjectManager(context.membership, context.assignment)) {
        return response(403, { error: "Project manager access required" });
      }
      const page = await store.listPendingTime(context, nextToken);
      return response(200, { timeEntries: page.items, nextToken: page.nextToken });
    }

    const taskMatch = new RegExp(`^tasks/${routeId}$`).exec(suffix);
    if (taskMatch && method === "PATCH") {
      return await updateTask(event, store, context, actorId, taskMatch[1]!, dependencies);
    }
    const submitMatch = new RegExp(`^time-entries/${routeId}/submit$`).exec(suffix);
    if (submitMatch && method === "POST") {
      return await submitTimeEntry(event, store, context, actorId, submitMatch[1]!, dependencies);
    }
    const timeEntryMatch = new RegExp(`^time-entries/${routeId}$`).exec(suffix);
    if (timeEntryMatch && method === "PATCH") {
      return await updateTimeDraft(event, store, context, actorId, timeEntryMatch[1]!, dependencies);
    }
    const reviewMatch = new RegExp(`^time-entries/${routeId}/review$`).exec(suffix);
    if (reviewMatch && method === "POST") {
      return await reviewTimeEntry(event, store, context, actorId, reviewMatch[1]!, dependencies);
    }
    if (method === "POST" && suffix === "time-entries") {
      return await createTimeEntry(event, store, context, actorId, dependencies);
    }
    return response(404, { error: "Not found" });
  } catch (error) {
    if (error instanceof InvalidWorkspaceCursorError) return response(400, { error: "Invalid page token" });
    if (error instanceof WorkspaceConflictError) {
      return response(409, { error: "Workspace record changed or is no longer available. Refresh before retrying." });
    }
    console.error("Project workspace request failed", error instanceof Error ? error.name : "UnknownError");
    return response(500, { error: "Unable to complete project workspace request" });
  }
}

async function createAssignment(
  event: Request, store: WorkspaceStore, context: ProjectContext,
  actorId: string, dependencies: WorkspaceHandlerDependencies,
): Promise<APIGatewayProxyStructuredResultV2> {
  if (!canAccessProject(context.membership, context.assignment, { projectId: context.project.projectId }, "manage_tasks")) {
    return response(403, { error: "Project manager access required" });
  }
  const body = await readBody(event);
  if (body instanceof BodyError) return response(body.status, { error: body.message });
  const assignment = parseCreateAssignment(body);
  if (!assignment) return response(400, { error: "Invalid project assignment" });
  if (assignment.userId === actorId) return response(400, { error: "Managers cannot replace their own assignment" });
  if (assignment.role === "manager" && context.membership.projectAdmin !== true) {
    return response(403, { error: "Project administrator access required" });
  }
  const targetMembership = await store.getMembership(assignment.userId);
  if (!targetMembership?.active) return response(400, { error: "Active Consulting membership required for assignee" });
  const now = (dependencies.now ?? (() => new Date()))();
  const created = await store.createAssignment(context, actorId, assignment, now, newId(dependencies));
  audit(event, actorId, "project_assignment_created", context.project.projectId, assignment.userId);
  return response(201, created);
}

async function createTask(
  event: Request, store: WorkspaceStore, context: ProjectContext,
  actorId: string, dependencies: WorkspaceHandlerDependencies,
): Promise<APIGatewayProxyStructuredResultV2> {
  if (!canAccessProject(context.membership, context.assignment, { projectId: context.project.projectId }, "manage_tasks")) {
    return response(403, { error: "Project manager access required" });
  }
  const body = await readBody(event);
  if (body instanceof BodyError) return response(body.status, { error: body.message });
  const task = parseCreateTask(body);
  if (!task) return response(400, { error: "Invalid task" });
  const assignee = await store.getContext(task.assignedToUserId, context.project.projectId);
  if (!assignee || !assignee.membership.active || !assignee.assignment.active) {
    return response(400, { error: "Task assignee must have an active project assignment" });
  }
  const created = await store.createTask(context, actorId, task, (dependencies.now ?? (() => new Date()))(), newId(dependencies));
  audit(event, actorId, "project_task_created", context.project.projectId, created.taskId);
  return response(201, created);
}

async function updateTask(
  event: Request, store: WorkspaceStore, context: ProjectContext,
  actorId: string, taskId: string, dependencies: WorkspaceHandlerDependencies,
): Promise<APIGatewayProxyStructuredResultV2> {
  const task = await store.getTask(context.project.projectId, taskId);
  if (!task || !canAccessProject(context.membership, context.assignment, {
    projectId: context.project.projectId, workerId: task.assignedToUserId,
  }, "update_task")) return response(404, { error: "Task not found" });
  const body = await readBody(event);
  if (body instanceof BodyError) return response(body.status, { error: body.message });
  const update = parseTaskUpdate(body);
  if (!update) return response(400, { error: "Invalid task update" });
  if (task.version !== update.expectedVersion || !canTransitionTask(task.status, update.status)) {
    return response(409, { error: "Task changed or its status cannot be changed. Refresh before retrying." });
  }
  const changed = await store.updateTask(
    context, actorId, task, update.status, update.expectedVersion, (dependencies.now ?? (() => new Date()))(),
  );
  audit(event, actorId, "project_task_status_updated", context.project.projectId, task.taskId, changed.version);
  return response(200, changed);
}

async function createTimeEntry(
  event: Request, store: WorkspaceStore, context: ProjectContext,
  actorId: string, dependencies: WorkspaceHandlerDependencies,
): Promise<APIGatewayProxyStructuredResultV2> {
  if (!canAccessProject(context.membership, context.assignment, {
    projectId: context.project.projectId, workerId: actorId,
  }, "log_time")) return response(403, { error: "Only your own time may be submitted" });
  const body = await readBody(event);
  if (body instanceof BodyError) return response(body.status, { error: body.message });
  if (!isObject(body) || Object.keys(body).sort().join(",") !== "description,minutes,taskId,workDate") {
    return response(400, { error: "Invalid time entry" });
  }
  const submission = parseTimeSubmission({ ...body, projectId: context.project.projectId });
  if (!submission || !isProjectId(submission.taskId)) return response(400, { error: "Invalid time entry" });
  const task = await store.getTask(context.project.projectId, submission.taskId);
  if (!task || task.assignedToUserId !== actorId) {
    return response(403, { error: "Time may be logged only to your assigned task" });
  }
  const entry = await store.createTimeEntry(
    context, actorId, submission, (dependencies.now ?? (() => new Date()))(), newId(dependencies),
  );
  audit(event, actorId, "time_entry_draft_created", context.project.projectId, entry.timeEntryId, entry.version);
  return response(201, entry);
}

async function submitTimeEntry(
  event: Request, store: WorkspaceStore, context: ProjectContext,
  actorId: string, timeEntryId: string, dependencies: WorkspaceHandlerDependencies,
): Promise<APIGatewayProxyStructuredResultV2> {
  const body = await readBody(event);
  if (body instanceof BodyError) return response(body.status, { error: body.message });
  if (!isObject(body) || Object.keys(body).sort().join(",") !== "expectedVersion"
    || typeof body.expectedVersion !== "number" || !Number.isSafeInteger(body.expectedVersion)
    || body.expectedVersion < 0 || body.expectedVersion >= Number.MAX_SAFE_INTEGER) {
    return response(400, { error: "Invalid time entry submission" });
  }
  const entry = await store.getTimeEntry(context.project.projectId, timeEntryId);
  if (!entry || entry.workerId !== actorId) return response(404, { error: "Time entry not found" });
  if (!canAccessProject(context.membership, context.assignment, {
    projectId: context.project.projectId, workerId: entry.workerId,
  }, "log_time")) return response(403, { error: "Only your own time may be submitted" });
  if (entry.status !== "DRAFT" || entry.version !== body.expectedVersion) {
    return response(409, { error: "Time entry changed or is not a draft. Refresh before retrying." });
  }
  const submitted = await store.submitTimeEntry(
    context, actorId, entry, body.expectedVersion, (dependencies.now ?? (() => new Date()))(),
  );
  audit(event, actorId, "time_entry_submitted", context.project.projectId, entry.timeEntryId, submitted.version);
  return response(200, submitted);
}

async function updateTimeDraft(
  event: Request, store: WorkspaceStore, context: ProjectContext,
  actorId: string, timeEntryId: string, dependencies: WorkspaceHandlerDependencies,
): Promise<APIGatewayProxyStructuredResultV2> {
  const body = await readBody(event);
  if (body instanceof BodyError) return response(body.status, { error: body.message });
  const update = parseTimeDraftUpdate(body);
  if (!update) return response(400, { error: "Invalid time draft correction" });
  const entry = await store.getTimeEntry(context.project.projectId, timeEntryId);
  if (!entry || entry.workerId !== actorId) return response(404, { error: "Time entry not found" });
  if (!canAccessProject(context.membership, context.assignment, {
    projectId: context.project.projectId, workerId: actorId,
  }, "log_time")) return response(403, { error: "Only your own time may be corrected" });
  if ((entry.status !== "DRAFT" && entry.status !== "REJECTED") || entry.version !== update.expectedVersion) {
    return response(409, { error: "Time entry changed or is not editable. Refresh before retrying." });
  }
  const task = await store.getTask(context.project.projectId, update.taskId);
  if (!task || task.assignedToUserId !== actorId) {
    return response(403, { error: "Time may be corrected only to your assigned task" });
  }
  const corrected = await store.updateTimeDraft(
    context, actorId, entry, update, (dependencies.now ?? (() => new Date()))(),
  );
  audit(event, actorId, "time_draft_corrected", context.project.projectId, entry.timeEntryId, corrected.version);
  return response(200, corrected);
}

async function reviewTimeEntry(
  event: Request, store: WorkspaceStore, context: ProjectContext,
  actorId: string, timeEntryId: string, dependencies: WorkspaceHandlerDependencies,
): Promise<APIGatewayProxyStructuredResultV2> {
  if (!isProjectManager(context.membership, context.assignment)) {
    return response(403, { error: "Project manager access required" });
  }
  const body = await readBody(event);
  if (body instanceof BodyError) return response(body.status, { error: body.message });
  const review = parseTimeReview(body);
  if (!review) return response(400, { error: "Invalid time review" });
  const entry = await store.getTimeEntry(context.project.projectId, timeEntryId);
  if (!entry || entry.status !== "SUBMITTED") return response(404, { error: "Submitted time entry not found" });
  if (!canAccessProject(context.membership, context.assignment, {
    projectId: context.project.projectId, workerId: entry.workerId,
  }, "approve_time")) return response(403, { error: "Managers cannot approve their own time" });
  if (entry.version !== review.expectedVersion) {
    return response(409, { error: "Time entry changed. Refresh before reviewing." });
  }
  const reviewed = await store.reviewTimeEntry(
    context, actorId, entry, review, (dependencies.now ?? (() => new Date()))(),
  );
  audit(event, actorId, `time_entry_${review.decision.toLowerCase()}`, context.project.projectId,
    entry.timeEntryId, reviewed.version);
  return response(200, reviewed);
}

async function listOwnTimeEntries(
  event: Request, store: WorkspaceStore, actorId: string, nextToken?: string,
): Promise<APIGatewayProxyStructuredResultV2> {
  const membership = await store.getMembership(actorId);
  if (!membership?.active) return response(403, { error: "Active Consulting membership required" });
  const page = await store.listMyTimeEntries(actorId, nextToken);
  const contexts = await Promise.all([...new Set(page.items.map((entry) => entry.projectId))]
    .map(async (projectId) => [projectId, await store.getContext(actorId, projectId)] as const));
  const byProject = new Map(contexts);
  const entries = page.items.filter((entry) => {
    const context = byProject.get(entry.projectId);
    return entry.workerId === actorId && context !== null && context !== undefined
      && canAccessProject(context.membership, context.assignment, {
        projectId: entry.projectId, workerId: actorId,
      }, "log_time");
  });
  return response(200, { timeEntries: entries, nextToken: page.nextToken });
}

async function readBody(event: Request): Promise<unknown | BodyError> {
  if (event.headers["content-type"]?.split(";")[0]?.trim().toLowerCase() !== "application/json") {
    return new BodyError(415, "JSON content type required");
  }
  if (event.body === undefined) return new BodyError(400, "Invalid workspace request");
  if (event.body.length > 11_000) return new BodyError(413, "Workspace request is too large");
  try {
    const raw = event.isBase64Encoded ? Buffer.from(event.body, "base64") : Buffer.from(event.body);
    if (raw.byteLength > 8192) return new BodyError(413, "Workspace request is too large");
    return JSON.parse(raw.toString("utf8")) as unknown;
  } catch {
    return new BodyError(400, "Invalid workspace request");
  }
}

class BodyError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function authenticatedSubject(event: Request): string | null {
  const subject = event.requestContext.authorizer?.jwt?.claims?.sub;
  return isPrincipalId(subject) ? subject : null;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function newId(dependencies: WorkspaceHandlerDependencies): string {
  return (dependencies.newId ?? randomUUID)();
}

function audit(
  event: Request, actorId: string, name: string, projectId: string, recordId: string, version?: number,
): void {
  console.info(JSON.stringify({
    event: name, actorSub: actorId, projectId, recordId,
    requestId: event.requestContext.requestId,
    ...(version === undefined ? {} : { version }),
  }));
}
