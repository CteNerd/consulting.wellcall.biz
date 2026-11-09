import { ConditionalCheckFailedException, TransactionCanceledException } from "@aws-sdk/client-dynamodb";
import {
  GetCommand, QueryCommand, TransactWriteCommand,
  type TransactWriteCommandInput, type DynamoDBDocumentClient,
} from "@aws-sdk/lib-dynamodb";
import type { Membership, ProjectAssignment } from "../../../packages/domain/src/authorization.ts";
import type {
  CreateAssignment, CreateTask, ProjectSummary, ProjectTask, TaskStatus, TimeEntry,
  TimeReview, TimeReviewDecision, TimeSubmission,
} from "../../../packages/domain/src/workspace.ts";

type CursorKey = Record<string, string>;
type PendingCursorKey = Record<string, string>;
export type ProjectContext = {
  membership: Membership;
  assignment: ProjectAssignment;
  project: ProjectSummary;
};
type Page<T> = { items: T[]; nextToken: string | null };

export class WorkspaceConflictError extends Error {
  constructor() {
    super("Workspace record changed or is no longer available");
  }
}

export class InvalidWorkspaceCursorError extends Error {
  constructor() {
    super("Invalid workspace page cursor");
  }
}

export type WorkspaceStore = {
  getMembership(userId: string): Promise<Membership | null>;
  getContext(userId: string, projectId: string): Promise<ProjectContext | null>;
  listProjects(userId: string, nextToken?: string): Promise<Page<ProjectSummary>>;
  listAssignments(context: ProjectContext, nextToken?: string): Promise<Page<ProjectAssignment>>;
  listTasks(userId: string, context: ProjectContext, nextToken?: string): Promise<Page<ProjectTask>>;
  getTask(projectId: string, taskId: string): Promise<ProjectTask | null>;
  createAssignment(
    context: ProjectContext, actorId: string, assignment: CreateAssignment, now: Date, assignmentId: string,
  ): Promise<ProjectAssignment>;
  createTask(
    context: ProjectContext, actorId: string, task: CreateTask, now: Date, taskId: string,
  ): Promise<ProjectTask>;
  updateTask(
    context: ProjectContext, actorId: string, task: ProjectTask, status: TaskStatus, expectedVersion: number,
    now: Date,
  ): Promise<ProjectTask>;
  listMyTimeEntries(userId: string, nextToken?: string): Promise<Page<TimeEntry>>;
  getTimeEntry(projectId: string, timeEntryId: string): Promise<TimeEntry | null>;
  listPendingTime(context: ProjectContext, nextToken?: string): Promise<Page<TimeEntry>>;
  createTimeEntry(
    context: ProjectContext, actorId: string, submission: TimeSubmission, now: Date, timeEntryId: string,
  ): Promise<TimeEntry>;
  submitTimeEntry(
    context: ProjectContext, actorId: string, entry: TimeEntry, expectedVersion: number, now: Date,
  ): Promise<TimeEntry>;
  reviewTimeEntry(
    context: ProjectContext, actorId: string, entry: TimeEntry, review: TimeReview, now: Date,
  ): Promise<TimeEntry>;
};

export class DynamoWorkspaceStore implements WorkspaceStore {
  private readonly client: DynamoDBDocumentClient;
  private readonly tableName: string;

  constructor(client: DynamoDBDocumentClient, tableName: string) {
    this.client = client;
    this.tableName = tableName;
  }

  async getMembership(userId: string): Promise<Membership | null> {
    const result = await this.client.send(new GetCommand({
      TableName: this.tableName, Key: { PK: `USER#${userId}`, SK: "MEMBERSHIP" }, ConsistentRead: true,
    }));
    return result.Item ? toMembership(result.Item, userId) : null;
  }

  async getContext(userId: string, projectId: string): Promise<ProjectContext | null> {
    const [membership, assignmentResult, projectResult] = await Promise.all([
      this.getMembership(userId),
      this.client.send(new GetCommand({
        TableName: this.tableName,
        Key: { PK: `PROJECT#${projectId}`, SK: `ASSIGNMENT#${userId}` },
        ConsistentRead: true,
      })),
      this.client.send(new GetCommand({
        TableName: this.tableName,
        Key: { PK: `PROJECT#${projectId}`, SK: "METADATA" },
        ConsistentRead: true,
      })),
    ]);
    if (!membership || !assignmentResult.Item || !projectResult.Item) return null;
    const assignment = toAssignment(assignmentResult.Item, userId, projectId);
    const project = toProject(projectResult.Item, projectId);
    if (!assignment || !project) return null;
    return { membership, assignment, project };
  }

  async listProjects(userId: string, nextToken?: string): Promise<Page<ProjectSummary>> {
    const cursor = nextToken === undefined ? undefined : decodeCursor(nextToken, "projects", userId);
    const result = await this.client.send(new QueryCommand({
      TableName: this.tableName, IndexName: "WorkspaceIndex",
      KeyConditionExpression: "GSI3PK = :user AND begins_with(GSI3SK, :assignment)",
      ExpressionAttributeValues: { ":user": `USER#${userId}`, ":assignment": "ASSIGNMENT#" },
      Limit: 25, ScanIndexForward: true,
      ...(cursor === undefined ? {} : { ExclusiveStartKey: cursor }),
    }));
    const rows = result.Items ?? [];
    const resolved = await Promise.all(rows.map(async (row) => {
      const projectId = projectIdFromKey(row.PK);
      if (!projectId || row.recordType !== "ASSIGNMENT" || row.userId !== userId) return null;
      const [assignmentResult, projectResult] = await Promise.all([
        this.client.send(new GetCommand({
          TableName: this.tableName, Key: { PK: `PROJECT#${projectId}`, SK: `ASSIGNMENT#${userId}` },
          ConsistentRead: true,
        })),
        this.client.send(new GetCommand({
          TableName: this.tableName, Key: { PK: `PROJECT#${projectId}`, SK: "METADATA" }, ConsistentRead: true,
        })),
      ]);
      const assignment = assignmentResult.Item
        ? toAssignment(assignmentResult.Item, userId, projectId)
        : null;
      const project = projectResult.Item ? toProject(projectResult.Item, projectId) : null;
      return assignment?.active && project ? project : null;
    }));
    return { items: resolved.filter((item): item is ProjectSummary => item !== null), nextToken: nextCursor(result.LastEvaluatedKey) };
  }

  async listAssignments(context: ProjectContext, nextToken?: string): Promise<Page<ProjectAssignment>> {
    const projectId = context.project.projectId;
    const cursor = nextToken === undefined ? undefined
      : decodeCursor(nextToken, "projectAssignments", "", projectId);
    const result = await this.client.send(new QueryCommand({
      TableName: this.tableName,
      KeyConditionExpression: "PK = :project AND begins_with(SK, :assignment)",
      ExpressionAttributeValues: { ":project": `PROJECT#${projectId}`, ":assignment": "ASSIGNMENT#" },
      Limit: 25, ScanIndexForward: true,
      ...(cursor === undefined ? {} : { ExclusiveStartKey: cursor }),
    }));
    return {
      items: (result.Items ?? []).map((item) => {
        const userId = item.userId;
        if (typeof userId !== "string") return null;
        return toAssignment(item, userId, projectId);
      }).filter((assignment): assignment is ProjectAssignment => assignment !== null && assignment.active),
      nextToken: nextCursor(result.LastEvaluatedKey),
    };
  }

  async listTasks(userId: string, context: ProjectContext, nextToken?: string): Promise<Page<ProjectTask>> {
    const manager = context.membership.projectAdmin === true || context.assignment.role === "manager";
    const cursor = nextToken === undefined ? undefined
      : decodeCursor(nextToken, manager ? "projectTasks" : "assignedTasks", userId, context.project.projectId);
    const result = await this.client.send(new QueryCommand(manager ? {
      TableName: this.tableName,
      KeyConditionExpression: "PK = :project AND begins_with(SK, :task)",
      ExpressionAttributeValues: { ":project": `PROJECT#${context.project.projectId}`, ":task": "TASK#" },
      Limit: 50, ScanIndexForward: true,
      ...(cursor === undefined ? {} : { ExclusiveStartKey: cursor }),
    } : {
      TableName: this.tableName, IndexName: "WorkspaceIndex",
      KeyConditionExpression: "GSI3PK = :user AND begins_with(GSI3SK, :taskPrefix)",
      ExpressionAttributeValues: {
        ":user": `USER#${userId}`, ":taskPrefix": `TASK#${context.project.projectId}#`,
      },
      Limit: 50, ScanIndexForward: true,
      ...(cursor === undefined ? {} : { ExclusiveStartKey: cursor }),
    }));
    const items = (result.Items ?? [])
      .map(toTask)
      .filter((task): task is ProjectTask => task !== null && task.projectId === context.project.projectId
        && (manager || task.assignedToUserId === userId));
    return { items, nextToken: nextCursor(result.LastEvaluatedKey) };
  }

  async getTask(projectId: string, taskId: string): Promise<ProjectTask | null> {
    const result = await this.client.send(new GetCommand({
      TableName: this.tableName,
      Key: { PK: `PROJECT#${projectId}`, SK: `TASK#${taskId}` },
      ConsistentRead: true,
    }));
    return result.Item ? toTask(result.Item) : null;
  }

  async createAssignment(
    context: ProjectContext, actorId: string, assignment: CreateAssignment, now: Date, assignmentId: string,
  ): Promise<ProjectAssignment> {
    const projectId = context.project.projectId;
    const item = {
      PK: `PROJECT#${projectId}`, SK: `ASSIGNMENT#${assignment.userId}`, recordType: "ASSIGNMENT",
      assignmentId, userId: assignment.userId, projectId, role: assignment.role, active: true,
      GSI3PK: `USER#${assignment.userId}`, GSI3SK: `ASSIGNMENT#${projectId}`,
      createdAt: now.toISOString(), createdBy: actorId,
    };
    const audit = auditItem(projectId, actorId, "ASSIGNMENT_CREATED", "ASSIGNMENT", assignment.userId, now, assignmentId);
    const conditions = [
      ...managerConditions(this.tableName, context, actorId),
      projectCondition(this.tableName, projectId),
      membershipCondition(this.tableName, assignment.userId),
      {
        Put: {
          TableName: this.tableName, Item: item,
          ConditionExpression: "attribute_not_exists(PK)",
        },
      },
      putAudit(this.tableName, audit),
    ];
    await sendTransaction(this.client, { TransactItems: conditions });
    return { userId: assignment.userId, projectId, role: assignment.role, active: true };
  }

  async createTask(
    context: ProjectContext, actorId: string, task: CreateTask, now: Date, taskId: string,
  ): Promise<ProjectTask> {
    const projectId = context.project.projectId;
    const item = {
      PK: `PROJECT#${projectId}`, SK: `TASK#${taskId}`, recordType: "TASK",
      projectId, taskId, title: task.title, description: task.description,
      assignedToUserId: task.assignedToUserId, status: "TODO", version: 0,
      GSI3PK: `USER#${task.assignedToUserId}`, GSI3SK: `TASK#${projectId}#${taskId}`,
      createdAt: now.toISOString(), updatedAt: now.toISOString(), createdBy: actorId,
    };
    const audit = auditItem(projectId, actorId, "TASK_CREATED", "TASK", taskId, now, taskId, 0, 0);
    await sendTransaction(this.client, { TransactItems: [
      ...managerConditions(this.tableName, context, actorId),
      projectCondition(this.tableName, projectId),
      ...(task.assignedToUserId === actorId ? [] : [
        membershipCondition(this.tableName, task.assignedToUserId),
        assignmentCondition(this.tableName, task.assignedToUserId, projectId),
      ]),
      {
        Put: {
          TableName: this.tableName, Item: item,
          ConditionExpression: "attribute_not_exists(PK)",
        },
      },
      putAudit(this.tableName, audit),
    ] });
    return toTask(item)!;
  }

  async updateTask(
    context: ProjectContext, actorId: string, task: ProjectTask, status: TaskStatus, expectedVersion: number,
    now: Date,
  ): Promise<ProjectTask> {
    const projectId = task.projectId;
    const taskId = task.taskId;
    const manager = context.membership.projectAdmin === true || context.assignment.role === "manager";
    const audit = auditItem(projectId, actorId, "TASK_STATUS_CHANGED", "TASK", taskId, now,
      `${taskId}-${expectedVersion + 1}`, expectedVersion, expectedVersion + 1);
    await sendTransaction(this.client, { TransactItems: [
      ...(manager
        ? managerConditions(this.tableName, context, actorId)
        : [membershipCondition(this.tableName, actorId), assignmentCondition(this.tableName, actorId, projectId)]),
      {
        Update: {
          TableName: this.tableName, Key: { PK: `PROJECT#${projectId}`, SK: `TASK#${taskId}` },
          UpdateExpression: "SET #status = :status, #version = :nextVersion, updatedAt = :updatedAt, updatedBy = :actor",
          ConditionExpression: "#recordType = :task AND #version = :expectedVersion AND #assignee = :assignee",
          ExpressionAttributeNames: { "#recordType": "recordType", "#status": "status", "#version": "version", "#assignee": "assignedToUserId" },
          ExpressionAttributeValues: {
            ":task": "TASK", ":status": status, ":expectedVersion": expectedVersion,
            ":nextVersion": expectedVersion + 1, ":updatedAt": now.toISOString(), ":actor": actorId,
            ":assignee": manager ? task.assignedToUserId : actorId,
          },
        },
      },
      putAudit(this.tableName, audit),
    ] });
    return { ...task, status, version: expectedVersion + 1, updatedAt: now.toISOString() };
  }

  async listMyTimeEntries(userId: string, nextToken?: string): Promise<Page<TimeEntry>> {
    const cursor = nextToken === undefined ? undefined : decodeCursor(nextToken, "myTime", userId);
    const result = await this.client.send(new QueryCommand({
      TableName: this.tableName, IndexName: "WorkspaceIndex",
      KeyConditionExpression: "GSI3PK = :user AND begins_with(GSI3SK, :time)",
      ExpressionAttributeValues: { ":user": `USER#${userId}`, ":time": "TIME#" },
      Limit: 50, ScanIndexForward: false,
      ...(cursor === undefined ? {} : { ExclusiveStartKey: cursor }),
    }));
    return {
      items: (result.Items ?? []).map(toTimeEntry).filter((entry): entry is TimeEntry => entry !== null
        && entry.workerId === userId),
      nextToken: nextCursor(result.LastEvaluatedKey),
    };
  }

  async getTimeEntry(projectId: string, timeEntryId: string): Promise<TimeEntry | null> {
    const result = await this.client.send(new GetCommand({
      TableName: this.tableName,
      Key: { PK: `PROJECT#${projectId}`, SK: `TIME#${timeEntryId}` },
      ConsistentRead: true,
    }));
    return result.Item ? toTimeEntry(result.Item) : null;
  }

  async listPendingTime(context: ProjectContext, nextToken?: string): Promise<Page<TimeEntry>> {
    const projectId = context.project.projectId;
    const cursor = nextToken === undefined ? undefined : decodePendingCursor(nextToken, projectId);
    const result = await this.client.send(new QueryCommand({
      TableName: this.tableName, IndexName: "OutboxPendingIndex",
      KeyConditionExpression: "GSI2PK = :pending",
      ExpressionAttributeValues: { ":pending": `PROJECT#${projectId}#PENDING_TIME` },
      Limit: 25, ScanIndexForward: true,
      ...(cursor === undefined ? {} : { ExclusiveStartKey: cursor }),
    }));
    return {
      items: (result.Items ?? []).map(toTimeEntry).filter((entry): entry is TimeEntry =>
        entry !== null && entry.projectId === projectId && entry.status === "SUBMITTED"),
      nextToken: nextCursor(result.LastEvaluatedKey),
    };
  }

  async createTimeEntry(
    context: ProjectContext, actorId: string, submission: TimeSubmission, now: Date, timeEntryId: string,
  ): Promise<TimeEntry> {
    const projectId = context.project.projectId;
    const item = {
      PK: `PROJECT#${projectId}`, SK: `TIME#${timeEntryId}`, recordType: "TIME_ENTRY",
      projectId, timeEntryId, taskId: submission.taskId, workerId: actorId,
      workDate: submission.workDate, minutes: submission.minutes, description: submission.description,
      status: "DRAFT", version: 0, GSI3PK: `USER#${actorId}`,
      GSI3SK: `TIME#${projectId}#${submission.workDate}#${timeEntryId}`,
      createdAt: now.toISOString(),
    };
    const audit = auditItem(projectId, actorId, "TIME_DRAFT_CREATED", "TIME_ENTRY", timeEntryId, now, timeEntryId, 0, 0);
    await sendTransaction(this.client, { TransactItems: [
      membershipCondition(this.tableName, actorId),
      assignmentCondition(this.tableName, actorId, projectId),
      projectCondition(this.tableName, projectId),
      {
        ConditionCheck: {
          TableName: this.tableName, Key: { PK: `PROJECT#${projectId}`, SK: `TASK#${submission.taskId}` },
          ConditionExpression: "#recordType = :task AND #assignee = :actor",
          ExpressionAttributeNames: { "#recordType": "recordType", "#assignee": "assignedToUserId" },
          ExpressionAttributeValues: { ":task": "TASK", ":actor": actorId },
        },
      },
      {
        Put: {
          TableName: this.tableName, Item: item,
          ConditionExpression: "attribute_not_exists(PK)",
        },
      },
      putAudit(this.tableName, audit),
    ] });
    return toTimeEntry(item)!;
  }

  async submitTimeEntry(
    context: ProjectContext, actorId: string, entry: TimeEntry, expectedVersion: number, now: Date,
  ): Promise<TimeEntry> {
    const projectId = entry.projectId;
    const nextVersion = expectedVersion + 1;
    const submittedAt = now.toISOString();
    const audit = auditItem(projectId, actorId, "TIME_SUBMITTED", "TIME_ENTRY", entry.timeEntryId, now,
      `${entry.timeEntryId}-${nextVersion}`, expectedVersion, nextVersion);
    await sendTransaction(this.client, { TransactItems: [
      membershipCondition(this.tableName, actorId),
      assignmentCondition(this.tableName, actorId, projectId),
      {
        Update: {
          TableName: this.tableName, Key: { PK: `PROJECT#${projectId}`, SK: `TIME#${entry.timeEntryId}` },
          UpdateExpression: "SET #status = :submitted, #version = :nextVersion, submittedAt = :submittedAt, "
            + "GSI2PK = :pendingKey, GSI2SK = :pendingSortKey",
          ConditionExpression: "#recordType = :entry AND #worker = :actor AND #status = :draft "
            + "AND #version = :expectedVersion",
          ExpressionAttributeNames: {
            "#recordType": "recordType", "#worker": "workerId", "#status": "status", "#version": "version",
          },
          ExpressionAttributeValues: {
            ":entry": "TIME_ENTRY", ":actor": actorId, ":draft": "DRAFT", ":submitted": "SUBMITTED",
            ":expectedVersion": expectedVersion, ":nextVersion": nextVersion, ":submittedAt": submittedAt,
            ":pendingKey": `PROJECT#${projectId}#PENDING_TIME`, ":pendingSortKey": `${submittedAt}#${entry.timeEntryId}`,
          },
        },
      },
      putAudit(this.tableName, audit),
    ] });
    return { ...entry, status: "SUBMITTED", version: nextVersion, submittedAt };
  }

  async reviewTimeEntry(
    context: ProjectContext, actorId: string, entry: TimeEntry, review: TimeReview, now: Date,
  ): Promise<TimeEntry> {
    const projectId = entry.projectId;
    const nextVersion = review.expectedVersion + 1;
    const reviewedAt = now.toISOString();
    const audit = auditItem(projectId, actorId, `TIME_${review.decision}`, "TIME_ENTRY", entry.timeEntryId,
      now, `${entry.timeEntryId}-${nextVersion}`, review.expectedVersion, nextVersion);
    await sendTransaction(this.client, { TransactItems: [
      ...managerConditions(this.tableName, context, actorId),
      {
        Update: {
          TableName: this.tableName, Key: { PK: `PROJECT#${projectId}`, SK: `TIME#${entry.timeEntryId}` },
          UpdateExpression: "SET #status = :decision, #version = :nextVersion, reviewedAt = :reviewedAt, "
            + "reviewedBy = :actor, reviewDecision = :decision, reviewNote = :note REMOVE GSI2PK, GSI2SK",
          ConditionExpression: "#recordType = :entry AND #worker <> :actor AND #status = :submitted "
            + "AND #version = :expectedVersion",
          ExpressionAttributeNames: {
            "#recordType": "recordType", "#worker": "workerId", "#status": "status", "#version": "version",
          },
          ExpressionAttributeValues: {
            ":entry": "TIME_ENTRY", ":actor": actorId, ":submitted": "SUBMITTED",
            ":decision": review.decision, ":expectedVersion": review.expectedVersion,
            ":nextVersion": nextVersion, ":reviewedAt": reviewedAt, ":note": review.note,
          },
        },
      },
      putAudit(this.tableName, audit),
    ] });
    return {
      ...entry, status: review.decision, version: nextVersion, reviewedAt, reviewedBy: actorId,
      reviewDecision: review.decision, reviewNote: review.note,
    };
  }
}

export function buildMembershipCondition(tableName: string, userId: string) {
  return membershipCondition(tableName, userId);
}

function membershipCondition(tableName: string, userId: string) {
  return {
    ConditionCheck: {
      TableName: tableName, Key: { PK: `USER#${userId}`, SK: "MEMBERSHIP" },
      ConditionExpression: "#recordType = :membership AND #active = :active",
      ExpressionAttributeNames: { "#recordType": "recordType", "#active": "active" },
      ExpressionAttributeValues: { ":membership": "MEMBERSHIP", ":active": true },
    },
  };
}

function assignmentCondition(tableName: string, userId: string, projectId: string) {
  return {
    ConditionCheck: {
      TableName: tableName, Key: { PK: `PROJECT#${projectId}`, SK: `ASSIGNMENT#${userId}` },
      ConditionExpression: "#recordType = :assignment AND #active = :active",
      ExpressionAttributeNames: { "#recordType": "recordType", "#active": "active" },
      ExpressionAttributeValues: { ":assignment": "ASSIGNMENT", ":active": true },
    },
  };
}

function managerConditions(tableName: string, context: ProjectContext, userId: string) {
  const membershipCheck = context.membership.projectAdmin === true
    ? {
      ConditionCheck: {
        TableName: tableName, Key: { PK: `USER#${userId}`, SK: "MEMBERSHIP" },
        ConditionExpression: "#recordType = :membership AND #active = :active AND #projectAdmin = :admin",
        ExpressionAttributeNames: {
          "#recordType": "recordType", "#active": "active", "#projectAdmin": "projectAdmin",
        },
        ExpressionAttributeValues: { ":membership": "MEMBERSHIP", ":active": true, ":admin": true },
      },
    }
    : membershipCondition(tableName, userId);
  const assignmentCheck = context.assignment.role === "manager"
    ? {
      ConditionCheck: {
        TableName: tableName,
        Key: { PK: `PROJECT#${context.project.projectId}`, SK: `ASSIGNMENT#${userId}` },
        ConditionExpression: "#recordType = :assignment AND #active = :active AND #role = :manager",
        ExpressionAttributeNames: { "#recordType": "recordType", "#active": "active", "#role": "role" },
        ExpressionAttributeValues: { ":assignment": "ASSIGNMENT", ":active": true, ":manager": "manager" },
      },
    }
    : assignmentCondition(tableName, userId, context.project.projectId);
  return [membershipCheck, assignmentCheck];
}

function projectCondition(tableName: string, projectId: string) {
  return {
    ConditionCheck: {
      TableName: tableName, Key: { PK: `PROJECT#${projectId}`, SK: "METADATA" },
      ConditionExpression: "#recordType = :project AND #projectId = :projectId",
      ExpressionAttributeNames: { "#recordType": "recordType", "#projectId": "projectId" },
      ExpressionAttributeValues: { ":project": "PROJECT", ":projectId": projectId },
    },
  };
}

function auditItem(
  projectId: string, actorId: string, action: string, entityType: string, entityId: string,
  now: Date, auditId: string, fromVersion?: number, toVersion?: number,
) {
  const timestamp = now.toISOString();
  return {
    PK: `PROJECT#${projectId}`, SK: `AUDIT#${timestamp}#${auditId}`,
    recordType: "AUDIT", projectId, actorId, action, entityType, entityId, occurredAt: timestamp,
    ...(fromVersion === undefined ? {} : { fromVersion }),
    ...(toVersion === undefined ? {} : { toVersion }),
  };
}

function putAudit(tableName: string, item: Record<string, unknown>) {
  return {
    Put: { TableName: tableName, Item: item, ConditionExpression: "attribute_not_exists(PK)" },
  };
}

async function sendTransaction(
  client: DynamoDBDocumentClient, input: TransactWriteCommandInput,
): Promise<void> {
  try {
    await client.send(new TransactWriteCommand(input));
  } catch (error) {
    if (error instanceof ConditionalCheckFailedException || error instanceof TransactionCanceledException) {
      throw new WorkspaceConflictError();
    }
    throw error;
  }
}

function toMembership(value: Record<string, unknown>, userId: string): Membership | null {
  if (value.recordType !== "MEMBERSHIP" || value.userId !== userId
    || typeof value.active !== "boolean") return null;
  return {
    userId, active: value.active, financeAccess: value.financeAccess === true,
    projectAdmin: value.projectAdmin === true,
  };
}

function toAssignment(
  value: Record<string, unknown>, userId: string, projectId: string,
): ProjectAssignment | null {
  if (value.recordType !== "ASSIGNMENT" || value.userId !== userId || value.projectId !== projectId
    || typeof value.active !== "boolean" || (value.role !== "contributor" && value.role !== "manager")) return null;
  return { userId, projectId, active: value.active, role: value.role };
}

function toProject(value: Record<string, unknown>, projectId: string): ProjectSummary | null {
  if (value.recordType !== "PROJECT" || value.projectId !== projectId
    || typeof value.name !== "string" || typeof value.status !== "string") return null;
  return { projectId, name: value.name, status: value.status };
}

function toTask(value: Record<string, unknown>): ProjectTask | null {
  if (value.recordType !== "TASK" || typeof value.projectId !== "string" || typeof value.taskId !== "string"
    || typeof value.title !== "string" || typeof value.description !== "string"
    || typeof value.assignedToUserId !== "string" || !isTaskStatus(value.status)
    || !isVersion(value.version) || typeof value.createdAt !== "string" || typeof value.updatedAt !== "string") return null;
  return {
    projectId: value.projectId, taskId: value.taskId, title: value.title, description: value.description,
    assignedToUserId: value.assignedToUserId, status: value.status, version: value.version,
    createdAt: value.createdAt, updatedAt: value.updatedAt,
  };
}

function toTimeEntry(value: Record<string, unknown>): TimeEntry | null {
  if (value.recordType !== "TIME_ENTRY" || typeof value.projectId !== "string"
    || typeof value.timeEntryId !== "string" || typeof value.taskId !== "string" || typeof value.workerId !== "string"
    || typeof value.workDate !== "string" || typeof value.minutes !== "number" || !Number.isSafeInteger(value.minutes)
    || typeof value.description !== "string" || !isTimeStatus(value.status) || !isVersion(value.version)
    || typeof value.createdAt !== "string") return null;
  return {
    projectId: value.projectId, timeEntryId: value.timeEntryId, taskId: value.taskId, workerId: value.workerId,
    workDate: value.workDate, minutes: value.minutes, description: value.description, status: value.status,
    version: value.version, createdAt: value.createdAt,
    ...(typeof value.submittedAt === "string" ? { submittedAt: value.submittedAt } : {}),
    ...(typeof value.reviewedAt === "string" ? { reviewedAt: value.reviewedAt } : {}),
    ...(typeof value.reviewedBy === "string" ? { reviewedBy: value.reviewedBy } : {}),
    ...(isReviewDecision(value.reviewDecision) ? { reviewDecision: value.reviewDecision } : {}),
    ...(typeof value.reviewNote === "string" ? { reviewNote: value.reviewNote } : {}),
  };
}

function encodeCursor(value: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function nextCursor(value: Record<string, unknown> | undefined): string | null {
  return value === undefined ? null : encodeCursor(value);
}

function decodeCursor(
  token: string, type: "projects" | "projectAssignments" | "projectTasks" | "assignedTasks" | "myTime", userId: string,
  projectId?: string,
): CursorKey {
  const primaryKeyCursor = type === "projectTasks" || type === "projectAssignments";
  const expectedKeys = primaryKeyCursor ? ["PK", "SK"] : ["GSI3PK", "GSI3SK", "PK", "SK"];
  const value = parseCursor(token, expectedKeys);
  if (!value || (!primaryKeyCursor && value.GSI3PK !== `USER#${userId}`)) {
    throw new InvalidWorkspaceCursorError();
  }
  const recordProjectId = projectIdFromKey(value.PK);
  if (!recordProjectId) throw new InvalidWorkspaceCursorError();
  if (type === "projects") {
    if (value.SK !== `ASSIGNMENT#${userId}` || value.GSI3SK !== `ASSIGNMENT#${recordProjectId}`) {
      throw new InvalidWorkspaceCursorError();
    }
  } else if (type === "projectAssignments") {
    const assignedUserId = value.SK!.slice("ASSIGNMENT#".length);
    if (recordProjectId !== projectId || value.SK !== `ASSIGNMENT#${assignedUserId}`
      || !/^[A-Za-z0-9_-]{1,128}$/.test(assignedUserId)) throw new InvalidWorkspaceCursorError();
  } else if (type === "projectTasks" || type === "assignedTasks") {
    const taskId = value.SK!.slice("TASK#".length);
    if (recordProjectId !== projectId || !isUuid(taskId)
      || (type === "assignedTasks" && value.GSI3SK !== `TASK#${recordProjectId}#${taskId}`)) {
      throw new InvalidWorkspaceCursorError();
    }
  } else {
    const match = /^TIME#([0-9a-f-]{36})#\d{4}-\d{2}-\d{2}#([0-9a-f-]{36})$/i.exec(value.GSI3SK!);
    if (!match || match[1] !== recordProjectId || !isUuid(match[2]!) || value.SK !== `TIME#${match[2]}`) {
      throw new InvalidWorkspaceCursorError();
    }
  }
  return value as CursorKey;
}

function decodePendingCursor(token: string, projectId: string): PendingCursorKey {
  const value = parseCursor(token, ["GSI2PK", "GSI2SK", "PK", "SK"]);
  if (!value || value.GSI2PK !== `PROJECT#${projectId}#PENDING_TIME`
    || value.PK !== `PROJECT#${projectId}`) throw new InvalidWorkspaceCursorError();
  const entryId = value.SK!.slice("TIME#".length);
  if (!isUuid(entryId) || !value.GSI2SK!.startsWith("20") || !value.GSI2SK!.endsWith(`#${entryId}`)) {
    throw new InvalidWorkspaceCursorError();
  }
  return value as PendingCursorKey;
}

function parseCursor(token: string, keys: string[]): Record<string, string> | null {
  if (token.length > 2048 || !/^[A-Za-z0-9_-]+$/.test(token)) return null;
  try {
    const parsed: unknown = JSON.parse(Buffer.from(token, "base64url").toString("utf8"));
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;
    const value = parsed as Record<string, unknown>;
    if (Object.keys(value).sort().join(",") !== keys.slice().sort().join(",")
      || Object.values(value).some((item) => typeof item !== "string")) return null;
    return value as Record<string, string>;
  } catch {
    return null;
  }
}

function projectIdFromKey(value: unknown): string | null {
  if (typeof value !== "string" || !value.startsWith("PROJECT#")) return null;
  const id = value.slice("PROJECT#".length);
  return isUuid(id) ? id : null;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function isVersion(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isTaskStatus(value: unknown): value is TaskStatus {
  return value === "TODO" || value === "IN_PROGRESS" || value === "BLOCKED" || value === "DONE";
}

function isTimeStatus(value: unknown): value is TimeEntry["status"] {
  return value === "DRAFT" || value === "SUBMITTED" || value === "APPROVED" || value === "REJECTED";
}

function isReviewDecision(value: unknown): value is TimeReviewDecision {
  return value === "APPROVED" || value === "REJECTED";
}
