import assert from "node:assert/strict";
import { test } from "node:test";
import {
  canTransitionTask, parseCreateAssignment, parseCreateTask, parseTaskUpdate,
  parseTimeReview, parseTimeSubmission,
} from "./workspace.ts";

const projectId = "b9de9897-5f48-4a63-a872-1d1b53bd64a5";
const taskId = "e8de9897-5f48-4a63-a872-1d1b53bd64a5";

test("workspace parsers accept only bounded exact assignment, task, and time payloads", () => {
  assert.deepEqual(parseCreateAssignment({ userId: "member-1", role: "contributor" }), {
    userId: "member-1", role: "contributor",
  });
  assert.equal(parseCreateAssignment({ userId: "member-1", role: "administrator" }), undefined);
  assert.equal(parseCreateAssignment({ userId: "member-1", role: "manager", active: true }), undefined);
  assert.deepEqual(parseCreateTask({
    title: "  Build API  ", description: "  Scope  ", assignedToUserId: "member-1",
  }), { title: "Build API", description: "Scope", assignedToUserId: "member-1" });
  assert.equal(parseCreateTask({
    title: "x".repeat(121), description: "", assignedToUserId: "member-1",
  }), undefined);
  assert.equal(parseTaskUpdate({ status: "DONE", expectedVersion: 0, updatedBy: "forged" }), undefined);
  assert.deepEqual(parseTimeSubmission({
    projectId, taskId, workDate: "2026-11-08", minutes: 60, description: "Implementation",
  }), { projectId, taskId, workDate: "2026-11-08", minutes: 60, description: "Implementation" });
  assert.equal(parseTimeSubmission({
    projectId, taskId, workDate: "2026-02-30", minutes: 60, description: "",
  }), undefined);
  assert.equal(parseTimeSubmission({
    projectId, taskId, workDate: "2026-11-08", minutes: 1441, description: "",
  }), undefined);
});

test("time review and task transitions require supported, versioned state changes", () => {
  assert.deepEqual(parseTimeReview({ decision: "APPROVED", expectedVersion: 1 }), {
    decision: "APPROVED", expectedVersion: 1, note: "",
  });
  assert.equal(parseTimeReview({ decision: "APPROVED", expectedVersion: -1 }), undefined);
  assert.equal(parseTimeReview({ decision: "APPROVED", expectedVersion: 1, approvedBy: "forged" }), undefined);
  assert.equal(canTransitionTask("TODO", "IN_PROGRESS"), true);
  assert.equal(canTransitionTask("IN_PROGRESS", "DONE"), true);
  assert.equal(canTransitionTask("DONE", "IN_PROGRESS"), false);
  assert.equal(canTransitionTask("TODO", "TODO"), false);
});
