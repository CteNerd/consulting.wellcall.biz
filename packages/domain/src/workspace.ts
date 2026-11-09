import type { Membership, ProjectAssignment } from "./authorization.ts";

export type TaskStatus = "TODO" | "IN_PROGRESS" | "BLOCKED" | "DONE";
export type TimeEntryStatus = "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED";
export type TimeReviewDecision = "APPROVED" | "REJECTED";

export type ProjectSummary = {
  projectId: string;
  name: string;
  status: string;
};

export type ProjectTask = {
  projectId: string;
  taskId: string;
  title: string;
  description: string;
  assignedToUserId: string;
  status: TaskStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type TimeEntry = {
  projectId: string;
  timeEntryId: string;
  taskId: string;
  workerId: string;
  workDate: string;
  minutes: number;
  description: string;
  status: TimeEntryStatus;
  version: number;
  createdAt: string;
  submittedAt?: string;
  reviewedAt?: string;
  reviewedBy?: string;
  reviewDecision?: TimeReviewDecision;
  reviewNote?: string;
};

export type CreateAssignment = { userId: string; role: ProjectAssignment["role"] };
export type CreateTask = { title: string; description: string; assignedToUserId: string };
export type TaskUpdate = { status: TaskStatus; expectedVersion: number };
export type TimeSubmission = {
  projectId: string;
  taskId: string;
  workDate: string;
  minutes: number;
  description: string;
};
export type TimeReview = {
  decision: TimeReviewDecision;
  expectedVersion: number;
  note: string;
};

export function isProjectId(value: unknown): value is string {
  return typeof value === "string"
    && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function isPrincipalId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 128
    && /^[A-Za-z0-9_-]+$/.test(value);
}

export function parseCreateAssignment(value: unknown): CreateAssignment | undefined {
  const input = objectWithKeys(value, ["userId", "role"]);
  if (!input || !isPrincipalId(input.userId)
    || (input.role !== "contributor" && input.role !== "manager")) return undefined;
  return { userId: input.userId, role: input.role };
}

export function parseCreateTask(value: unknown): CreateTask | undefined {
  const input = objectWithKeys(value, ["title", "description", "assignedToUserId"]);
  if (!input || typeof input.title !== "string" || typeof input.description !== "string"
    || !isPrincipalId(input.assignedToUserId)) return undefined;
  const title = input.title.trim();
  const description = input.description.trim();
  if (title.length === 0 || title.length > 120 || description.length > 1000
    || hasControls(title) || hasControls(description)) return undefined;
  return { title, description, assignedToUserId: input.assignedToUserId };
}

export function parseTaskUpdate(value: unknown): TaskUpdate | undefined {
  const input = objectWithKeys(value, ["status", "expectedVersion"]);
  if (!input || !isTaskStatus(input.status) || !isExpectedVersion(input.expectedVersion)) return undefined;
  return { status: input.status, expectedVersion: input.expectedVersion };
}

export function canTransitionTask(from: TaskStatus, to: TaskStatus): boolean {
  if (from === "DONE") return false;
  if (from === to) return false;
  return true;
}

export function parseTimeSubmission(value: unknown): TimeSubmission | undefined {
  const input = objectWithKeys(value, ["projectId", "taskId", "workDate", "minutes", "description"]);
  if (!input || !isProjectId(input.projectId) || !isProjectId(input.taskId)
    || !isWorkDate(input.workDate) || typeof input.minutes !== "number"
    || !Number.isSafeInteger(input.minutes) || input.minutes < 1 || input.minutes > 1440
    || typeof input.description !== "string") return undefined;
  const description = input.description.trim();
  if (description.length > 500 || hasControls(description)) return undefined;
  return {
    projectId: input.projectId,
    taskId: input.taskId,
    workDate: input.workDate,
    minutes: input.minutes,
    description,
  };
}

export function parseTimeReview(value: unknown): TimeReview | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  const input = value as Record<string, unknown>;
  const keys = Object.keys(input).sort().join(",");
  if ((keys !== "decision,expectedVersion,note" && keys !== "decision,expectedVersion")
    || (input.decision !== "APPROVED" && input.decision !== "REJECTED")
    || !isExpectedVersion(input.expectedVersion)) return undefined;
  const note = input.note === undefined ? "" : input.note;
  if (typeof note !== "string" || note.length > 500 || hasControls(note)) return undefined;
  return { decision: input.decision, expectedVersion: input.expectedVersion, note: note.trim() };
}

export function isProjectManager(
  membership: Membership,
  assignment: ProjectAssignment,
): boolean {
  return membership.projectAdmin === true || assignment.role === "manager";
}

function isTaskStatus(value: unknown): value is TaskStatus {
  return value === "TODO" || value === "IN_PROGRESS" || value === "BLOCKED" || value === "DONE";
}

function isExpectedVersion(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value)
    && value >= 0 && value < Number.MAX_SAFE_INTEGER;
}

function isWorkDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function hasControls(value: string): boolean {
  return /[\u0000-\u001f\u007f]/.test(value);
}

function objectWithKeys(value: unknown, expected: string[]): Record<string, unknown> | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  const input = value as Record<string, unknown>;
  return Object.keys(input).sort().join(",") === expected.slice().sort().join(",") ? input : undefined;
}
