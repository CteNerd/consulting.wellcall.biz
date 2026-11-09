import type { AdminAuthConfiguration } from "./admin-auth.ts";

export type WorkspaceProject = {
  projectId: string;
  name: string;
  status: string;
};

export type WorkspaceTask = {
  projectId: string;
  taskId: string;
  title: string;
  description: string;
  assignedToUserId: string;
  status: "TODO" | "IN_PROGRESS" | "BLOCKED" | "DONE";
  version: number;
};

export type WorkspaceTimeEntry = {
  projectId: string;
  timeEntryId: string;
  taskId: string;
  workerId: string;
  workDate: string;
  minutes: number;
  description: string;
  status: "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED";
  version: number;
  reviewedAt?: string;
  reviewedBy?: string;
  reviewDecision?: "APPROVED" | "REJECTED";
  reviewNote?: string;
};

export type WorkspaceAssignment = {
  userId: string;
  projectId: string;
  role: "contributor" | "manager";
  active: boolean;
};

export type WorkspaceRequestOptions = {
  method?: string;
  body?: object;
  signal?: AbortSignal;
};

export type WorkspaceClient = {
  request(path: string, options?: WorkspaceRequestOptions): Promise<unknown>;
};

export type RehearsalPersona = {
  id: string;
  label: string;
  userId: string;
  summary: string;
};

export type RehearsalWorkspaceClient = WorkspaceClient & {
  readonly personas: RehearsalPersona[];
  readonly currentPersona: RehearsalPersona;
  selectPersona(personaId: string): void;
};

export class WorkspaceRequestError extends Error {
  constructor(readonly statusCode: number) {
    super("Workspace request failed");
  }
}

export async function requestWorkspace(
  configuration: AdminAuthConfiguration,
  accessToken: string,
  path: string,
  options: { method?: string; body?: object; signal?: AbortSignal } = {},
): Promise<unknown> {
  const headers: Record<string, string> = { authorization: `Bearer ${accessToken}` };
  if (options.body !== undefined) headers["content-type"] = "application/json";
  const response = await fetch(new URL(path, configuration.apiUrl), {
    method: options.method ?? "GET",
    headers,
    cache: "no-store",
    ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
    ...(options.signal === undefined ? {} : { signal: options.signal }),
  });
  if (!response.ok) throw new WorkspaceRequestError(response.status);
  try {
    return await response.json() as unknown;
  } catch {
    throw new Error("The project workspace returned an invalid response.");
  }
}

export function createAuthenticatedWorkspaceClient(
  configuration: AdminAuthConfiguration,
  accessToken: string,
): WorkspaceClient {
  return {
    request: (path, options = {}) => requestWorkspace(configuration, accessToken, path, options),
  };
}

export function parseWorkspaceProject(value: unknown): WorkspaceProject {
  if (!isRecord(value) || typeof value.projectId !== "string" || !isUuid(value.projectId)
    || typeof value.name !== "string" || typeof value.status !== "string") {
    throw invalidResponse();
  }
  return { projectId: value.projectId, name: value.name, status: value.status };
}

export function parseWorkspaceTask(value: unknown): WorkspaceTask {
  if (!isRecord(value) || typeof value.projectId !== "string" || !isUuid(value.projectId)
    || typeof value.taskId !== "string" || !isUuid(value.taskId)
    || typeof value.title !== "string" || typeof value.description !== "string"
    || typeof value.assignedToUserId !== "string"
    || !["TODO", "IN_PROGRESS", "BLOCKED", "DONE"].includes(String(value.status))
    || !isVersion(value.version)) throw invalidResponse();
  return {
    projectId: value.projectId,
    taskId: value.taskId,
    title: value.title,
    description: value.description,
    assignedToUserId: value.assignedToUserId,
    status: value.status as WorkspaceTask["status"],
    version: value.version,
  };
}

export function parseWorkspaceTimeEntry(value: unknown): WorkspaceTimeEntry {
  if (!isRecord(value) || typeof value.projectId !== "string" || !isUuid(value.projectId)
    || typeof value.timeEntryId !== "string" || !isUuid(value.timeEntryId)
    || typeof value.taskId !== "string" || !isUuid(value.taskId)
    || typeof value.workerId !== "string" || typeof value.workDate !== "string"
    || typeof value.minutes !== "number" || !Number.isSafeInteger(value.minutes)
    || typeof value.description !== "string"
    || !["DRAFT", "SUBMITTED", "APPROVED", "REJECTED"].includes(String(value.status))
    || !isVersion(value.version)
    || (value.reviewedAt !== undefined && typeof value.reviewedAt !== "string")
    || (value.reviewedBy !== undefined && typeof value.reviewedBy !== "string")
    || (value.reviewDecision !== undefined && value.reviewDecision !== "APPROVED" && value.reviewDecision !== "REJECTED")
    || (value.reviewNote !== undefined && typeof value.reviewNote !== "string")) throw invalidResponse();
  return {
    projectId: value.projectId,
    timeEntryId: value.timeEntryId,
    taskId: value.taskId,
    workerId: value.workerId,
    workDate: value.workDate,
    minutes: value.minutes,
    description: value.description,
    status: value.status as WorkspaceTimeEntry["status"],
    version: value.version,
    ...(typeof value.reviewedAt === "string" ? { reviewedAt: value.reviewedAt } : {}),
    ...(typeof value.reviewedBy === "string" ? { reviewedBy: value.reviewedBy } : {}),
    ...(value.reviewDecision === "APPROVED" || value.reviewDecision === "REJECTED"
      ? { reviewDecision: value.reviewDecision } : {}),
    ...(typeof value.reviewNote === "string" ? { reviewNote: value.reviewNote } : {}),
  };
}

export function parseWorkspaceAssignment(value: unknown): WorkspaceAssignment {
  if (!isRecord(value) || typeof value.userId !== "string"
    || typeof value.projectId !== "string" || !isUuid(value.projectId)
    || (value.role !== "contributor" && value.role !== "manager")
    || typeof value.active !== "boolean") throw invalidResponse();
  return {
    userId: value.userId,
    projectId: value.projectId,
    role: value.role,
    active: value.active,
  };
}

export function parseWorkspacePage<T>(
  value: unknown,
  collection: "projects" | "tasks" | "assignments" | "timeEntries",
  parseItem: (item: unknown) => T,
): { items: T[]; nextToken: string | null } {
  if (!isRecord(value) || !Array.isArray(value[collection])
    || !(value.nextToken === null || typeof value.nextToken === "string")) {
    throw invalidResponse();
  }
  return { items: value[collection].map(parseItem), nextToken: value.nextToken };
}

export function workspaceErrorMessage(error: unknown): string {
  if (error instanceof WorkspaceRequestError) {
    if (error.statusCode === 401) return "Your session expired. Sign in again.";
    if (error.statusCode === 403) {
      return "Access denied. Confirm the active membership, project assignment, or manager permission for this action.";
    }
    if (error.statusCode === 404) return "That workspace record is no longer available. Refresh before retrying.";
    if (error.statusCode === 409) return "This record changed. Refresh before retrying.";
    if (error.statusCode === 400) return "The request was not accepted. Check the fields and refresh before retrying.";
    if (error.statusCode === 503) return "The project workspace is not available in this environment.";
  }
  if (error instanceof Error && error.message === "The project workspace returned an invalid response.") {
    return error.message;
  }
  return "The project workspace could not complete that request. Try refreshing.";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function isVersion(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function invalidResponse(): Error {
  return new Error("The project workspace returned an invalid response.");
}
