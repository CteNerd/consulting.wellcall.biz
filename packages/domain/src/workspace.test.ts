import assert from "node:assert/strict";
import { test } from "node:test";
import {
  canTransitionTask, parseCreateAssignment, parseCreateTask, parseTaskUpdate,
  parseTimeDraftUpdate, parseTimeReview, parseTimeSubmission,
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

test("free-text descriptions and review notes accept paragraphs but reject other controls", () => {
  const time = { projectId, taskId, workDate: "2026-11-08", minutes: 45 };
  const task = { title: "Build API", assignedToUserId: "member-1" };
  const correction = { taskId, workDate: time.workDate, minutes: time.minutes, expectedVersion: 0 };
  const review = { decision: "REJECTED", expectedVersion: 1 };
  const description = "First paragraph.\n\nSecond paragraph.\r\nFollow-up.";
  assert.equal(parseCreateTask({ ...task, description })?.description, description);
  assert.equal(parseTimeSubmission({ ...time, description })?.description, description);
  assert.equal(parseTimeDraftUpdate({ ...correction, description })?.description, description);
  assert.equal(parseTimeReview({ ...review, note: description })?.note, description);
  for (const control of ["\u0000", "\t", "\u001f", "\u007f"]) {
    const invalid = `First${control}second`;
    assert.equal(parseCreateTask({ ...task, description: invalid }), undefined);
    assert.equal(parseTimeSubmission({ ...time, description: invalid }), undefined);
    assert.equal(parseTimeDraftUpdate({ ...correction, description: invalid }), undefined);
    assert.equal(parseTimeReview({ ...review, note: invalid }), undefined);
  }
  for (const title of ["First\nsecond", "First\rsecond"]) {
    assert.equal(parseCreateTask({ ...task, title, description }), undefined);
  }
});

test("time draft correction accepts only bounded submission fields and an expected version", () => {
  assert.deepEqual(parseTimeDraftUpdate({
    taskId, workDate: "2026-11-08", minutes: 45, description: "  Corrected work  ", expectedVersion: 3,
  }), {
    taskId, workDate: "2026-11-08", minutes: 45, description: "Corrected work", expectedVersion: 3,
  });
  for (const invalid of [
    { taskId, workDate: "2026-11-08", minutes: 1441, description: "Work", expectedVersion: 0 },
    { taskId, workDate: "2026-02-30", minutes: 45, description: "Work", expectedVersion: 0 },
    { taskId, workDate: "2026-11-08", minutes: 45, description: "x".repeat(501), expectedVersion: 0 },
    { taskId, workDate: "2026-11-08", minutes: 45, description: "Work", expectedVersion: -1 },
    { taskId, workDate: "2026-11-08", minutes: 45, description: "Work", expectedVersion: 0, workerId: "forged" },
  ]) assert.equal(parseTimeDraftUpdate(invalid), undefined);
});
