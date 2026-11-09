import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { App } from "./App.tsx";
import { workspaceIntentKey } from "./Workspace.tsx";
import type { WorkspaceTask, WorkspaceTimeEntry } from "./workspace-client.ts";
import { parseWorkspacePage, parseWorkspaceProject } from "./workspace-client.ts";
import { createUatRehearsal } from "./uat-rehearsal.ts";

const authMock = vi.hoisted(() => ({
  beginSignIn: vi.fn(),
  completeSignIn: vi.fn(),
  clearSession: vi.fn(),
  signOut: vi.fn(),
  configured: true,
}));

vi.mock("./admin-auth.ts", () => ({
  readAdminAuthConfiguration: () => authMock.configured ? {
    authUrl: new URL("https://auth.example.test"),
    apiUrl: new URL("https://api.example.test"),
    clientId: "client123",
    userPoolId: "us-east-1_Example",
    callbackUrl: new URL("https://preview.example.test/"),
    issuer: "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_Example",
  } : undefined,
  createAdminAuth: () => authMock,
}));

const projectId = "11111111-1111-4111-8111-111111111111";
const taskId = "22222222-2222-4222-8222-222222222222";
const timeEntryId = "33333333-3333-4333-8333-333333333333";
const project = { projectId, name: "Website delivery", status: "ACTIVE" };
const ownTask = {
  projectId, taskId, title: "Build the intake page", description: "Use the approved brief.",
  assignedToUserId: "worker_1", status: "TODO", version: 3,
};
const submittedTime = {
  projectId, timeEntryId, taskId, workerId: "worker_2", workDate: "2026-11-08",
  minutes: 45, description: "Reviewed the implementation.", status: "SUBMITTED", version: 4,
};

beforeEach(() => {
  authMock.configured = true;
  authMock.beginSignIn.mockReset();
  authMock.completeSignIn.mockReset().mockResolvedValue("verified-access-token");
  authMock.clearSession.mockReset();
  authMock.signOut.mockReset();
  window.sessionStorage.clear();
  window.history.replaceState(null, "", "/");
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

test("the public footer offers a workspace entry without bypassing sign-in", async () => {
  render(<App />);
  expect(screen.getByRole("link", { name: "Team workspace" }).getAttribute("href")).toBe("/?workspace");
  cleanup();
  window.history.replaceState(null, "", "/?workspace");
  render(<App />);
  expect(screen.getByRole("heading", { name: "Assigned projects" })).toBeDefined();
  expect(screen.getByRole("button", { name: "Sign in" })).toBeDefined();
  expect(screen.queryByText("Website delivery")).toBeNull();
});

test("workspace callbacks restore a refreshable workspace URL rather than the admin inbox", async () => {
  authMock.completeSignIn.mockImplementation(async () => {
    window.history.replaceState(null, "", "/?admin");
    return "verified-access-token";
  });
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
    const path = new URL(String(input)).pathname;
    if (path === "/projects") return json(200, { projects: [project], nextToken: null });
    if (path === "/my/time-entries") return json(200, { timeEntries: [], nextToken: null });
    if (path === "/me") return json(200, { userId: "worker_1" });
    throw new Error(`Unexpected request: ${path}`);
  }));
  enterWorkspace();
  await screen.findByText("Website delivery");
  expect(window.location.search).toBe("?workspace");
  expect(window.sessionStorage.getItem(workspaceIntentKey)).toBeNull();
  cleanup();
  render(<App />);
  expect(screen.getByRole("heading", { name: "Assigned projects" })).toBeDefined();
  expect(screen.getByRole("button", { name: "Sign in" })).toBeDefined();
});

test("a contributor can draft and submit own time but sees no manager controls", async () => {
  const createdDraft = {
    projectId, timeEntryId: "44444444-4444-4444-8444-444444444444", taskId,
    workerId: "worker_1", workDate: "2026-11-08", minutes: 30, description: "Code review",
    status: "DRAFT", version: 0,
  };
  let draftCreated = false;
  let timeSubmitted = false;
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    if (url.pathname === "/projects") return json(200, { projects: [project], nextToken: null });
    if (url.pathname === "/my/time-entries") {
      return json(200, {
        timeEntries: timeSubmitted ? [{ ...createdDraft, status: "SUBMITTED", version: 1 }]
          : draftCreated ? [createdDraft] : [],
        nextToken: null,
      });
    }
    if (url.pathname === "/me") return json(200, { userId: "worker_1" });
    if (url.pathname === `/projects/${projectId}/tasks`) return json(200, { tasks: [ownTask], nextToken: null });
    if (url.pathname === `/projects/${projectId}/assignments`) return json(403, { error: "Project manager access required" });
    if (url.pathname === `/projects/${projectId}/time-entries` && init?.method === "POST") {
      draftCreated = true;
      return json(201, createdDraft);
    }
    if (url.pathname === `/projects/${projectId}/time-entries/${createdDraft.timeEntryId}/submit`
      && init?.method === "POST") {
      timeSubmitted = true;
      return json(200, { ...createdDraft, status: "SUBMITTED", version: 1 });
    }
    throw new Error(`Unexpected request: ${init?.method ?? "GET"} ${url.pathname}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  enterWorkspace();

  fireEvent.click(await screen.findByRole("button", { name: /Website delivery/ }));
  expect(await screen.findByRole("heading", { name: "Build the intake page" })).toBeDefined();
  expect(screen.queryByRole("heading", { name: "Project management" })).toBeNull();
  expect(screen.getByRole("heading", { name: "Create a time draft" })).toBeDefined();

  fireEvent.change(screen.getByLabelText("Assigned task"), { target: { value: taskId } });
  fireEvent.change(screen.getByLabelText("Work date"), { target: { value: "2026-11-08" } });
  fireEvent.change(screen.getByLabelText("Minutes (1–1440)"), { target: { value: "30" } });
  fireEvent.change(screen.getByLabelText("Work description"), { target: { value: "Code review" } });
  fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
  expect(await screen.findByText("Time draft saved.")).toBeDefined();
  const draftCall = fetchMock.mock.calls.find(([input, init]) =>
    new URL(String(input)).pathname === `/projects/${projectId}/time-entries` && init?.method === "POST");
  expect(draftCall?.[1]?.body).toEqual(expect.any(String));
  expect(JSON.parse(String(draftCall?.[1]?.body))).toEqual(expect.objectContaining({
    taskId, minutes: 30, description: "Code review", workDate: expect.any(String),
  }));
  expect(screen.getByRole("button", { name: "Submit for review" })).toBeDefined();
  fireEvent.click(screen.getByRole("button", { name: "Submit for review" }));
  expect(await screen.findByText("Time entry submitted for review.")).toBeDefined();
  expect(screen.queryByRole("button", { name: "Submit for review" })).toBeNull();
});

test("a contributor can correct rejected time and resubmit the confirmed draft", async () => {
  const rejected: WorkspaceTimeEntry = {
    projectId, timeEntryId, taskId, workerId: "worker_1", workDate: "2026-11-07",
    minutes: 45, description: "Initial summary", status: "REJECTED", version: 5,
    reviewDecision: "REJECTED", reviewNote: "Please describe the implementation work.",
    reviewedAt: "2026-11-08T14:00:00.000Z", reviewedBy: "manager_1",
  };
  let currentEntry: WorkspaceTimeEntry = rejected;
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    if (url.pathname === "/projects") return json(200, { projects: [project], nextToken: null });
    if (url.pathname === "/my/time-entries") return json(200, { timeEntries: [currentEntry], nextToken: null });
    if (url.pathname === "/me") return json(200, { userId: "worker_1" });
    if (url.pathname === `/projects/${projectId}/tasks`) return json(200, { tasks: [ownTask], nextToken: null });
    if (url.pathname === `/projects/${projectId}/assignments`) return json(403, { error: "Project manager access required" });
    if (url.pathname === `/projects/${projectId}/time-entries/${timeEntryId}` && init?.method === "PATCH") {
      const body = JSON.parse(String(init.body)) as {
        taskId: string; workDate: string; minutes: number; description: string; expectedVersion: number;
      };
      currentEntry = {
        projectId, timeEntryId, workerId: "worker_1", taskId: body.taskId, workDate: body.workDate,
        minutes: body.minutes, description: body.description, status: "DRAFT",
        version: body.expectedVersion + 1,
      };
      return json(200, currentEntry);
    }
    if (url.pathname.endsWith(`/time-entries/${timeEntryId}/submit`) && init?.method === "POST") {
      currentEntry = { ...currentEntry, status: "SUBMITTED", version: currentEntry.version + 1 };
      return json(200, currentEntry);
    }
    throw new Error(`Unexpected request: ${init?.method ?? "GET"} ${url.pathname}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  enterWorkspace();

  expect(await screen.findByText("Please describe the implementation work.")).toBeDefined();
  fireEvent.click(screen.getByRole("button", { name: "Correct rejected entry" }));
  fireEvent.change(await screen.findByLabelText("Corrected work date"), { target: { value: "2026-11-08" } });
  fireEvent.change(screen.getByLabelText("Corrected minutes (1–1440)"), { target: { value: "60" } });
  fireEvent.change(screen.getByLabelText("Corrected work description"), { target: { value: "Implemented and tested the change" } });
  fireEvent.click(screen.getByRole("button", { name: "Save correction" }));

  expect(await screen.findByText("Time draft corrected and saved.")).toBeDefined();
  expect(screen.getByRole("button", { name: "Submit for review" })).toBeDefined();
  expect(screen.queryByText("Please describe the implementation work.")).toBeNull();
  const correctionCall = fetchMock.mock.calls.find(([input, init]) =>
    new URL(String(input)).pathname === `/projects/${projectId}/time-entries/${timeEntryId}` && init?.method === "PATCH");
  expect(JSON.parse(String(correctionCall?.[1]?.body))).toEqual({
    taskId, workDate: "2026-11-08", minutes: 60,
    description: "Implemented and tested the change", expectedVersion: 5,
  });
  fireEvent.click(screen.getByRole("button", { name: "Submit for review" }));
  expect(await screen.findByText("Time entry submitted for review.")).toBeDefined();
});

test("a manager sees API-authorized controls and stale review responses are not shown as success", async () => {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    if (url.pathname === "/projects") return json(200, { projects: [project], nextToken: null });
    if (url.pathname === "/my/time-entries") return json(200, { timeEntries: [], nextToken: null });
    if (url.pathname === "/me") return json(200, { userId: "manager_1" });
    if (url.pathname === `/projects/${projectId}/tasks`) return json(200, { tasks: [], nextToken: null });
    if (url.pathname === `/projects/${projectId}/assignments`) {
      return json(200, {
        assignments: [
          { userId: "manager_1", projectId, role: "manager", active: true },
          { userId: "worker_2", projectId, role: "contributor", active: true },
        ],
        nextToken: null,
      });
    }
    if (url.pathname === `/projects/${projectId}/pending-time`) {
      return json(200, { timeEntries: [submittedTime], nextToken: null });
    }
    if (url.pathname.endsWith(`/time-entries/${timeEntryId}/review`) && init?.method === "POST") {
      return json(409, { error: "Time entry changed. Refresh before reviewing." });
    }
    throw new Error(`Unexpected request: ${init?.method ?? "GET"} ${url.pathname}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  enterWorkspace();
  fireEvent.click(await screen.findByRole("button", { name: /Website delivery/ }));

  expect(await screen.findByRole("heading", { name: "Project management" })).toBeDefined();
  expect(screen.getByLabelText("Consulting user ID")).toBeDefined();
  expect(screen.getByRole("heading", { name: "Submitted time for review" })).toBeDefined();
  fireEvent.click(screen.getByRole("button", { name: "Approve" }));
  expect(await screen.findByText("This record changed. Refresh before retrying.")).toBeDefined();
  const reviewCall = fetchMock.mock.calls.find(([input]) => new URL(String(input)).pathname.endsWith(`/time-entries/${timeEntryId}/review`));
  expect(reviewCall?.[1]?.body).toBe(JSON.stringify({ decision: "APPROVED", expectedVersion: 4 }));
  expect(screen.queryByText("Time entry approved.")).toBeNull();
});

test("a manager can create an assignment and task through the existing API", async () => {
  const secondAssignment = { userId: "worker_3", projectId, role: "contributor", active: true };
  let assigned = false;
  let createdTask: WorkspaceTask | undefined;
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    if (url.pathname === "/projects") return json(200, { projects: [project], nextToken: null });
    if (url.pathname === "/my/time-entries") return json(200, { timeEntries: [], nextToken: null });
    if (url.pathname === "/me") return json(200, { userId: "manager_1" });
    if (url.pathname === `/projects/${projectId}/tasks` && init?.method === "POST") {
      const body = JSON.parse(String(init.body)) as Record<string, unknown>;
      createdTask = {
        projectId,
        taskId: "55555555-5555-4555-8555-555555555555",
        title: String(body.title),
        description: String(body.description),
        assignedToUserId: String(body.assignedToUserId),
        status: "TODO",
        version: 0,
      };
      return json(201, createdTask);
    }
    if (createdTask && url.pathname === `/projects/${projectId}/tasks/${createdTask.taskId}` && init?.method === "PATCH") {
      const body = JSON.parse(String(init.body)) as { status: WorkspaceTask["status"]; expectedVersion: number };
      createdTask = { ...createdTask, status: body.status, version: body.expectedVersion + 1 };
      return json(200, createdTask);
    }
    if (url.pathname === `/projects/${projectId}/tasks`) {
      return json(200, { tasks: createdTask ? [createdTask] : [], nextToken: null });
    }
    if (url.pathname === `/projects/${projectId}/assignments`) {
      if (init?.method === "POST") {
        assigned = true;
        return json(201, secondAssignment);
      }
      return json(200, {
        assignments: [
          { userId: "manager_1", projectId, role: "manager", active: true },
          ...(assigned ? [secondAssignment] : []),
        ],
        nextToken: null,
      });
    }
    if (url.pathname === `/projects/${projectId}/pending-time`) {
      return json(200, { timeEntries: [], nextToken: null });
    }
    throw new Error(`Unexpected request: ${init?.method ?? "GET"} ${url.pathname}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  enterWorkspace();
  fireEvent.click(await screen.findByRole("button", { name: /Website delivery/ }));

  await screen.findByRole("heading", { name: "Project management" });
  fireEvent.change(screen.getByLabelText("Consulting user ID"), { target: { value: "worker_3" } });
  fireEvent.click(screen.getByRole("button", { name: "Create assignment" }));
  expect(await screen.findByText("Project assignment created.")).toBeDefined();
  expect(screen.getByText("worker_3")).toBeDefined();

  fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Review deployment plan" } });
  fireEvent.change(screen.getByLabelText("Description"), { target: { value: "Check rollout steps." } });
  fireEvent.change(screen.getByLabelText("Assigned user ID"), { target: { value: "worker_3" } });
  fireEvent.click(screen.getByRole("button", { name: "Create task" }));
  expect(await screen.findByRole("heading", { name: "Review deployment plan" })).toBeDefined();
  const createTaskCall = fetchMock.mock.calls.find(([input, init]) =>
    new URL(String(input)).pathname === `/projects/${projectId}/tasks` && init?.method === "POST");
  expect(JSON.parse(String(createTaskCall?.[1]?.body))).toEqual({
    title: "Review deployment plan",
    description: "Check rollout steps.",
    assignedToUserId: "worker_3",
  });
  fireEvent.change(screen.getByLabelText("Task status"), { target: { value: "IN_PROGRESS" } });
  fireEvent.click(screen.getByRole("button", { name: "Save task status" }));
  expect(await screen.findByText("Task status saved.")).toBeDefined();
  const taskUpdateCall = fetchMock.mock.calls.find(([input, init]) =>
    new URL(String(input)).pathname.endsWith(`/${createdTask?.taskId}`) && init?.method === "PATCH");
  expect(JSON.parse(String(taskUpdateCall?.[1]?.body))).toEqual({ status: "IN_PROGRESS", expectedVersion: 0 });
});

test("a stale task transition is rejected without changing the displayed task", async () => {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    if (url.pathname === "/projects") return json(200, { projects: [project], nextToken: null });
    if (url.pathname === "/my/time-entries") return json(200, { timeEntries: [], nextToken: null });
    if (url.pathname === "/me") return json(200, { userId: "worker_1" });
    if (url.pathname === `/projects/${projectId}/tasks`) return json(200, { tasks: [ownTask], nextToken: null });
    if (url.pathname === `/projects/${projectId}/assignments`) return json(403, { error: "Project manager access required" });
    if (url.pathname === `/projects/${projectId}/tasks/${taskId}` && init?.method === "PATCH") {
      return json(409, { error: "Task changed or its status cannot be changed." });
    }
    throw new Error(`Unexpected request: ${init?.method ?? "GET"} ${url.pathname}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  enterWorkspace();
  fireEvent.click(await screen.findByRole("button", { name: /Website delivery/ }));
  await screen.findByRole("heading", { name: "Build the intake page" });
  await waitFor(() => expect(screen.getByLabelText("Task status").hasAttribute("disabled")).toBe(false));
  fireEvent.change(screen.getByLabelText("Task status"), { target: { value: "IN_PROGRESS" } });
  await waitFor(() => expect(screen.getByRole("button", { name: "Save task status" }).hasAttribute("disabled")).toBe(false));
  fireEvent.click(screen.getByRole("button", { name: "Save task status" }));

  expect(await screen.findByText("This record changed. Refresh before retrying.")).toBeDefined();
  expect((screen.getByLabelText("Task status") as HTMLSelectElement).value).toBe("TODO");
  const updateCall = fetchMock.mock.calls.find(([input, init]) =>
    new URL(String(input)).pathname === `/projects/${projectId}/tasks/${taskId}` && init?.method === "PATCH");
  expect(JSON.parse(String(updateCall?.[1]?.body))).toEqual({ status: "IN_PROGRESS", expectedVersion: 3 });
});

test("a denied manager queue request is not presented as an empty queue", async () => {
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    if (url.pathname === "/projects") return json(200, { projects: [project], nextToken: null });
    if (url.pathname === "/my/time-entries") return json(200, { timeEntries: [], nextToken: null });
    if (url.pathname === "/me") return json(200, { userId: "manager_1" });
    if (url.pathname === `/projects/${projectId}/tasks`) return json(200, { tasks: [], nextToken: null });
    if (url.pathname === `/projects/${projectId}/assignments`) {
      return json(200, {
        assignments: [{ userId: "manager_1", projectId, role: "manager", active: true }],
        nextToken: null,
      });
    }
    if (url.pathname === `/projects/${projectId}/pending-time`) return json(403, { error: "Project manager access required" });
    throw new Error(`Unexpected request: ${url.pathname}`);
  }));
  enterWorkspace();
  fireEvent.click(await screen.findByRole("button", { name: /Website delivery/ }));

  expect(await screen.findByText(/Access denied\. Confirm the active membership, project assignment, or manager permission/)).toBeDefined();
  expect(screen.queryByText("No submitted time is awaiting review.")).toBeNull();
});

test("the synthetic UAT workspace requires explicit local opt-in and never uses fetch", async () => {
  const fetchMock = vi.fn(() => Promise.reject(new Error("Rehearsal must not use fetch")));
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("VITE_ENABLE_UAT_REHEARSAL", "");
  window.history.replaceState(null, "", "/?workspace&uatRehearsal=1");
  render(<App />);
  expect(screen.getByRole("button", { name: "Sign in" })).toBeDefined();
  expect(screen.queryByText("NOT REAL AUTH · NOT DYNAMODB · NOT A LIVE SERVICE")).toBeNull();

  cleanup();
  vi.stubEnv("VITE_ENABLE_UAT_REHEARSAL", "1");
  window.history.replaceState(null, "", "/?workspace");
  render(<App />);
  expect(screen.getByRole("button", { name: "Sign in" })).toBeDefined();
  expect(screen.queryByText("NOT REAL AUTH · NOT DYNAMODB · NOT A LIVE SERVICE")).toBeNull();

  cleanup();
  window.history.replaceState(null, "", "/?workspace&uatRehearsal=1");
  render(<App />);
  expect(await screen.findByText("NOT REAL AUTH · NOT DYNAMODB · NOT A LIVE SERVICE")).toBeDefined();
  expect(screen.queryByRole("button", { name: "Sign in" })).toBeNull();
  expect(screen.getByLabelText("Switch synthetic role")).toBeDefined();
  fireEvent.click(await screen.findByRole("button", { name: /Workflow improvement pilot/ }));
  expect(await screen.findByText("Please describe the deliverable and outcome.")).toBeDefined();
  expect(screen.getByRole("button", { name: "Correct rejected entry" })).toBeDefined();

  fireEvent.click(screen.getByRole("button", { name: "Prepare stale-version conflict" }));
  fireEvent.change(screen.getByLabelText("Task status"), { target: { value: "TODO" } });
  fireEvent.click(screen.getByRole("button", { name: "Save task status" }));
  expect(await screen.findByText("This record changed. Refresh before retrying.")).toBeDefined();

  fireEvent.change(screen.getByLabelText("Switch synthetic role"), { target: { value: "unassigned" } });
  expect(await screen.findByText("No assigned projects are available to this account.")).toBeDefined();
  expect(screen.queryByRole("button", { name: /Workflow improvement pilot/ })).toBeNull();
  expect(fetchMock).not.toHaveBeenCalled();
});

test("a 401 clears the project list and returns to a sign-in state", async () => {
  let projectCalls = 0;
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    if (url.pathname === "/projects") {
      projectCalls += 1;
      return projectCalls === 1
        ? json(200, { projects: [project], nextToken: null })
        : json(401, { error: "Authentication required" });
    }
    if (url.pathname === "/my/time-entries") return json(200, { timeEntries: [], nextToken: null });
    if (url.pathname === "/me") return json(200, { userId: "worker_1" });
    throw new Error(`Unexpected request: ${url.pathname}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  enterWorkspace();
  expect(await screen.findByText("Website delivery")).toBeDefined();
  fireEvent.click(screen.getByRole("button", { name: "Refresh workspace" }));
  expect(await screen.findByText("Your session expired. Sign in again.")).toBeDefined();
  expect(screen.queryByText("Website delivery")).toBeNull();
  expect(screen.getByRole("button", { name: "Sign in" })).toBeDefined();
  expect(authMock.clearSession).toHaveBeenCalledTimes(1);
});

test("synthetic manager permissions follow newly created assignments", async () => {
  const client = createUatRehearsal();
  client.selectPersona("administrator");
  const projects = parseWorkspacePage(await client.request("/projects"), "projects", parseWorkspaceProject);
  const path = `/projects/${projects.items[0]!.projectId}`;
  await client.request(`${path}/assignments`, {
    method: "POST", body: { userId: "uat-unassigned", role: "manager" },
  });
  client.selectPersona("unassigned");
  await expect(client.request(`${path}/tasks`)).resolves.toMatchObject({
    tasks: [expect.objectContaining({ assignedToUserId: "uat-contributor" })],
  });
  await expect(client.request(`${path}/assignments`)).resolves.toMatchObject({
    assignments: expect.arrayContaining([expect.objectContaining({ userId: "uat-unassigned", role: "manager" })]),
  });
  await expect(client.request(`${path}/pending-time`)).resolves.toMatchObject({ timeEntries: [] });
  await expect(client.request(`${path}/tasks`, {
    method: "POST", body: { title: "Review handoff", description: "", assignedToUserId: "uat-contributor" },
  })).resolves.toMatchObject({ title: "Review handoff", status: "TODO" });
});

test("synthetic duplicate assignments conflict without changing the existing role", async () => {
  const client = createUatRehearsal();
  client.selectPersona("administrator");
  const projects = parseWorkspacePage(await client.request("/projects"), "projects", parseWorkspaceProject);
  const path = `/projects/${projects.items[0]!.projectId}`;
  await expect(async () => client.request(`${path}/assignments`, {
    method: "POST", body: { userId: "uat-contributor", role: "manager" },
  })).rejects.toMatchObject({ statusCode: 409 });
  await expect(client.request(`${path}/assignments`)).resolves.toMatchObject({
    assignments: expect.arrayContaining([expect.objectContaining({ userId: "uat-contributor", role: "contributor" })]),
  });
  client.selectPersona("contributor");
  await expect(async () => client.request(`${path}/pending-time`)).rejects.toMatchObject({ statusCode: 403 });
});

test("missing membership is displayed as an access error without fake project data", async () => {
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    if (url.pathname === "/projects") return json(403, { error: "Active Consulting membership required" });
    if (url.pathname === "/my/time-entries") return json(403, { error: "Active Consulting membership required" });
    if (url.pathname === "/me") return json(200, { userId: "unassigned" });
    throw new Error(`Unexpected request: ${url.pathname}`);
  }));
  enterWorkspace();
  expect(await screen.findByText(/Access denied\. Confirm the active membership/)).toBeDefined();
  expect(screen.queryByText("Website delivery")).toBeNull();
  expect(screen.getByRole("button", { name: "Refresh workspace" })).toBeDefined();
});

function enterWorkspace() {
  window.sessionStorage.setItem(workspaceIntentKey, "workspace");
  window.history.replaceState(null, "", "/?code=callback-code&state=callback-state");
  render(<App />);
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
