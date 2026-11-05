import assert from "node:assert/strict";
import { test } from "node:test";
import { canAccessFinance, canAccessProject, type ProjectAssignment } from "./authorization.ts";

const member = { userId: "contributor", active: true, financeAccess: false };
const assignment: ProjectAssignment = {
  userId: "contributor", projectId: "assigned", active: true, role: "contributor",
};

test("project permission requires a matching active app membership and assignment", () => {
  assert.equal(canAccessProject(member, assignment, { projectId: "assigned" }, "manage_tasks"), true);
  assert.equal(canAccessProject(member, assignment, { projectId: "other" }, "read"), false);
  assert.equal(canAccessProject(null, assignment, { projectId: "assigned" }, "read"), false);
  assert.equal(canAccessProject(member, { ...assignment, active: false }, { projectId: "assigned" }, "read"), false);
  assert.equal(canAccessProject(member, { ...assignment, userId: "other" }, { projectId: "assigned" }, "read"), false);
  assert.equal(canAccessProject({ ...member, active: false }, assignment, { projectId: "assigned" }, "read"), false);
});

test("contributors log their own time but cannot approve or access finance", () => {
  assert.equal(canAccessProject(member, assignment, { projectId: "assigned", workerId: member.userId }, "log_time"), true);
  assert.equal(canAccessProject(member, assignment, { projectId: "assigned", workerId: "other" }, "log_time"), false);
  assert.equal(canAccessProject(member, assignment, { projectId: "assigned", workerId: "other" }, "approve_time"), false);
  assert.equal(canAccessFinance(member), false);
  assert.equal(canAccessFinance({ ...member, financeAccess: true }), true);
});

test("assigned managers cannot approve their own time or acquire implicit finance access", () => {
  const manager = { ...assignment, role: "manager" as const };
  assert.equal(canAccessProject(member, manager, { projectId: "assigned", workerId: member.userId }, "approve_time"), false);
  assert.equal(canAccessProject(member, manager, { projectId: "assigned", workerId: "other" }, "approve_time"), true);
  assert.equal(canAccessFinance(member), false);
});
