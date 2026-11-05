export type Membership = {
  userId: string;
  active: boolean;
  financeAccess: boolean;
};

export type ProjectAssignment = {
  userId: string;
  projectId: string;
  active: boolean;
  role: "contributor" | "manager";
};

export type ProjectAction = "read" | "manage_tasks" | "log_time" | "approve_time";

export function canAccessProject(
  membership: Membership | null,
  assignment: ProjectAssignment | null,
  resource: { projectId: string; workerId?: string },
  action: ProjectAction,
): boolean {
  if (!membership?.active || !assignment?.active) return false;
  if (assignment.userId !== membership.userId || assignment.projectId !== resource.projectId) return false;
  switch (action) {
    case "read":
    case "manage_tasks":
      return true;
    case "log_time":
      return resource.workerId === membership.userId;
    case "approve_time":
      return assignment.role === "manager" && resource.workerId !== undefined
        && resource.workerId !== membership.userId;
  }
}

export function canAccessFinance(membership: Membership | null): boolean {
  return membership?.active === true && membership.financeAccess === true;
}
