import {
  parseCreateTask, parseTaskUpdate, parseTimeDraftUpdate, parseTimeReview, parseTimeSubmission,
} from "../../../packages/domain/src/workspace.ts";
import {
  WorkspaceRequestError,
  type RehearsalPersona,
  type RehearsalWorkspaceClient,
  type WorkspaceRequestOptions,
  type WorkspaceTask,
  type WorkspaceTimeEntry,
} from "./workspace-client.ts";

const projectId = "7e3dd6a8-6074-42c0-9e83-f2917de26d44";
const seededTaskId = "6638aa52-6d3d-4ed1-8c5c-59d1b3d82a12";
const rejectedEntryId = "8f5d01a5-d1d7-4a60-bad6-a77158eff001";

const personas: RehearsalPersona[] = [
  { id: "manager", label: "Project manager", userId: "uat-manager", summary: "Assigned manager; can create tasks and review submitted time." },
  { id: "contributor", label: "Contributor", userId: "uat-contributor", summary: "Assigned contributor; sees own tasks and time only." },
  { id: "administrator", label: "App administrator", userId: "uat-admin", summary: "Active app administrator with a contributor project assignment." },
  { id: "unassigned", label: "Unassigned user", userId: "uat-unassigned", summary: "Active app member with no project assignment; project data stays out of scope." },
];

type RehearsalTask = WorkspaceTask & { createdAt: string; updatedAt: string };
type RehearsalTimeEntry = WorkspaceTimeEntry & {
  createdAt: string;
  submittedAt?: string;
  reviewedAt?: string;
  reviewedBy?: string;
};

const initialTasks: RehearsalTask[] = [{
  projectId, taskId: seededTaskId, title: "Map a real team workflow", description: "Start with the assigned work, then make one change that can be reviewed.",
  assignedToUserId: "uat-contributor", status: "IN_PROGRESS", version: 1,
  createdAt: "2026-11-09T10:00:00.000Z", updatedAt: "2026-11-09T10:00:00.000Z",
}];
const initialEntries: RehearsalTimeEntry[] = [{
  projectId, timeEntryId: rejectedEntryId, taskId: seededTaskId, workerId: "uat-contributor",
  workDate: "2026-11-08", minutes: 45, description: "Reviewed the current handoff.",
  status: "REJECTED", version: 2, createdAt: "2026-11-08T12:00:00.000Z",
  reviewedAt: "2026-11-09T09:00:00.000Z", reviewedBy: "uat-manager",
  reviewDecision: "REJECTED", reviewNote: "Please describe the deliverable and outcome.",
}];
export function createUatRehearsal(): RehearsalWorkspaceClient & { prepareConflict(): void } {
  const tasks = initialTasks.map((task) => ({ ...task }));
  const entries = initialEntries.map((entry) => ({ ...entry }));
  const assignments = new Map<string, "contributor" | "manager">([
    ["uat-manager", "manager"],
    ["uat-contributor", "contributor"],
    ["uat-admin", "contributor"],
  ]);
  let personaId = "contributor";
  let nextRecordId = 1;
  let conflictArmed = false;

  function currentPersona(): RehearsalPersona {
    return personas.find((persona) => persona.id === personaId)!;
  }

  function isManager(): boolean {
    return assignments.get(currentPersona().userId) === "manager" || personaId === "administrator";
  }

  function hasProjectAssignment(): boolean {
    return assignments.has(currentPersona().userId);
  }

  function requireProject(): void {
    if (!hasProjectAssignment()) throw new WorkspaceRequestError(403);
  }

  function requireManager(): void {
    requireProject();
    if (!isManager()) throw new WorkspaceRequestError(403);
  }

  function maybeConflict(): void {
    if (!conflictArmed) return;
    conflictArmed = false;
    throw new WorkspaceRequestError(409);
  }

  function nextId(): string {
    const tail = String(nextRecordId++).padStart(12, "0");
    return `a0000000-0000-4000-8000-${tail}`;
  }

  function request(path: string, options: WorkspaceRequestOptions = {}): Promise<unknown> {
    if (options.signal?.aborted) throw new DOMException("Request aborted", "AbortError");
    const method = options.method ?? "GET";
    const route = path.split("?")[0]!;
    const body = options.body;

    if (method === "GET" && route === "/me") return Promise.resolve({ userId: currentPersona().userId });
    if (method === "GET" && route === "/projects") {
      return Promise.resolve({
        projects: hasProjectAssignment() ? [{ projectId, name: "Workflow improvement pilot", status: "ACTIVE" }] : [],
        nextToken: null,
      });
    }
    if (method === "GET" && route === "/my/time-entries") {
      return Promise.resolve({
        timeEntries: entries.filter((entry) => entry.workerId === currentPersona().userId)
          .map((entry) => ({ ...entry })),
        nextToken: null,
      });
    }

    const taskList = new RegExp(`^/projects/${projectId}/tasks$`).exec(route);
    if (taskList && method === "GET") {
      requireProject();
      return Promise.resolve({
        tasks: tasks.filter((task) => isManager() || task.assignedToUserId === currentPersona().userId)
          .map((task) => ({ ...task })),
        nextToken: null,
      });
    }
    if (taskList && method === "POST") {
      requireManager();
      const taskInput = parseCreateTask(body);
      if (!taskInput) throw new WorkspaceRequestError(400);
      if (!assignments.has(taskInput.assignedToUserId)) throw new WorkspaceRequestError(400);
      maybeConflict();
      const now = new Date().toISOString();
      const task: RehearsalTask = {
        ...taskInput, projectId, taskId: nextId(), status: "TODO", version: 0,
        createdAt: now, updatedAt: now,
      };
      tasks.push(task);
      return Promise.resolve({ ...task });
    }

    const taskUpdate = new RegExp(`^/projects/${projectId}/tasks/([0-9a-f-]{36})$`).exec(route);
    if (taskUpdate && method === "PATCH") {
      requireProject();
      const task = tasks.find((item) => item.taskId === taskUpdate[1]);
      if (!task || (!isManager() && task.assignedToUserId !== currentPersona().userId)) {
        throw new WorkspaceRequestError(404);
      }
      const update = parseTaskUpdate(body);
      if (!update) throw new WorkspaceRequestError(400);
      if (task.version !== update.expectedVersion || task.status === "DONE" || task.status === update.status) {
        throw new WorkspaceRequestError(409);
      }
      maybeConflict();
      Object.assign(task, { status: update.status, version: task.version + 1, updatedAt: new Date().toISOString() });
      return Promise.resolve({ ...task });
    }

    if (method === "GET" && route === `/projects/${projectId}/assignments`) {
      requireManager();
      return Promise.resolve({
        assignments: [...assignments].map(([userId, role]) => ({
          userId, projectId, role, active: true,
        })),
        nextToken: null,
      });
    }
    if (method === "POST" && route === `/projects/${projectId}/assignments`) {
      requireManager();
      const input = parseAssignment(body);
      if (!input || input.userId === currentPersona().userId || !personas.some((item) => item.userId === input.userId)) {
        throw new WorkspaceRequestError(400);
      }
      if (input.role === "manager" && personaId !== "administrator") throw new WorkspaceRequestError(403);
      if (assignments.has(input.userId)) throw new WorkspaceRequestError(409);
      maybeConflict();
      assignments.set(input.userId, input.role);
      return Promise.resolve({ userId: input.userId, projectId, role: input.role, active: true });
    }

    if (method === "POST" && route === `/projects/${projectId}/time-entries`) {
      requireProject();
      const submission = parseTimeSubmission(isRecord(body) ? { ...body, projectId } : body);
      if (!submission || !isRecord(body) || Object.keys(body).sort().join(",") !== "description,minutes,taskId,workDate") {
        throw new WorkspaceRequestError(400);
      }
      if (!tasks.some((task) => task.taskId === submission.taskId
        && task.assignedToUserId === currentPersona().userId)) throw new WorkspaceRequestError(403);
      maybeConflict();
      const entry: RehearsalTimeEntry = {
        ...submission, timeEntryId: nextId(), workerId: currentPersona().userId,
        status: "DRAFT", version: 0, createdAt: new Date().toISOString(),
      };
      entries.push(entry);
      return Promise.resolve({ ...entry });
    }

    const timeEntry = new RegExp(`^/projects/${projectId}/time-entries/([0-9a-f-]{36})$`).exec(route);
    if (timeEntry && method === "PATCH") {
      requireProject();
      const entry = entries.find((item) => item.timeEntryId === timeEntry[1]);
      if (!entry || entry.workerId !== currentPersona().userId) throw new WorkspaceRequestError(404);
      const update = parseTimeDraftUpdate(body);
      if (!update) throw new WorkspaceRequestError(400);
      if ((entry.status !== "DRAFT" && entry.status !== "REJECTED") || entry.version !== update.expectedVersion) {
        throw new WorkspaceRequestError(409);
      }
      if (!tasks.some((task) => task.taskId === update.taskId
        && task.assignedToUserId === currentPersona().userId)) throw new WorkspaceRequestError(403);
      maybeConflict();
      Object.assign(entry, {
        taskId: update.taskId, workDate: update.workDate, minutes: update.minutes,
        description: update.description, status: "DRAFT", version: entry.version + 1,
        reviewedAt: undefined, reviewedBy: undefined, reviewDecision: undefined, reviewNote: undefined,
        submittedAt: undefined,
      });
      return Promise.resolve({ ...entry });
    }

    const submission = new RegExp(`^/projects/${projectId}/time-entries/([0-9a-f-]{36})/submit$`).exec(route);
    if (submission && method === "POST") {
      requireProject();
      const entry = entries.find((item) => item.timeEntryId === submission[1]);
      if (!entry || entry.workerId !== currentPersona().userId) throw new WorkspaceRequestError(404);
      if (!isExpectedVersionBody(body)) throw new WorkspaceRequestError(400);
      if (entry.status !== "DRAFT" || entry.version !== body.expectedVersion) throw new WorkspaceRequestError(409);
      if (!tasks.some((task) => task.taskId === entry.taskId
        && task.assignedToUserId === currentPersona().userId)) throw new WorkspaceRequestError(403);
      maybeConflict();
      Object.assign(entry, {
        status: "SUBMITTED", version: entry.version + 1, submittedAt: new Date().toISOString(),
      });
      return Promise.resolve({ ...entry });
    }

    if (method === "GET" && route === `/projects/${projectId}/pending-time`) {
      requireManager();
      return Promise.resolve({
        timeEntries: entries.filter((entry) => entry.status === "SUBMITTED").map((entry) => ({ ...entry })),
        nextToken: null,
      });
    }
    const review = new RegExp(`^/projects/${projectId}/time-entries/([0-9a-f-]{36})/review$`).exec(route);
    if (review && method === "POST") {
      requireManager();
      const entry = entries.find((item) => item.timeEntryId === review[1]);
      if (!entry || entry.status !== "SUBMITTED") throw new WorkspaceRequestError(404);
      if (entry.workerId === currentPersona().userId) throw new WorkspaceRequestError(403);
      const decision = parseTimeReview(body);
      if (!decision) throw new WorkspaceRequestError(400);
      if (entry.version !== decision.expectedVersion) throw new WorkspaceRequestError(409);
      maybeConflict();
      Object.assign(entry, {
        status: decision.decision, version: entry.version + 1,
        reviewedAt: new Date().toISOString(), reviewedBy: currentPersona().userId,
        reviewDecision: decision.decision, reviewNote: decision.note,
      });
      return Promise.resolve({ ...entry });
    }
    throw new WorkspaceRequestError(404);
  }

  return {
    personas,
    get currentPersona() { return currentPersona(); },
    request,
    selectPersona(nextPersonaId: string) {
      if (!personas.some((persona) => persona.id === nextPersonaId)) throw new Error("Unknown rehearsal persona.");
      personaId = nextPersonaId;
    },
    prepareConflict() {
      conflictArmed = true;
    },
  };
}

function parseAssignment(value: unknown): { userId: string; role: "contributor" | "manager" } | undefined {
  if (!isRecord(value) || Object.keys(value).sort().join(",") !== "role,userId"
    || typeof value.userId !== "string"
    || (value.role !== "contributor" && value.role !== "manager")) return undefined;
  return { userId: value.userId, role: value.role };
}

function isExpectedVersionBody(value: unknown): value is { expectedVersion: number } {
  return isRecord(value) && Object.keys(value).join(",") === "expectedVersion"
    && typeof value.expectedVersion === "number" && Number.isSafeInteger(value.expectedVersion)
    && value.expectedVersion >= 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
