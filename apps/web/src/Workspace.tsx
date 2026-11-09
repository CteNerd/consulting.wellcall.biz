import { useEffect, useMemo, useState, type FormEvent } from "react";
import { createAdminAuth, readAdminAuthConfiguration } from "./admin-auth.ts";
import {
  parseWorkspaceAssignment,
  parseWorkspacePage,
  parseWorkspaceProject,
  parseWorkspaceTask,
  parseWorkspaceTimeEntry,
  createAuthenticatedWorkspaceClient,
  workspaceErrorMessage,
  WorkspaceRequestError,
  type RehearsalWorkspaceClient,
  type WorkspaceClient,
  type WorkspaceAssignment,
  type WorkspaceProject,
  type WorkspaceTask,
  type WorkspaceTimeEntry,
} from "./workspace-client.ts";
import "./workspace.css";

export const workspaceIntentKey = "rct-consulting-workspace-entry";

type WorkspaceSetup = {
  configuration: NonNullable<ReturnType<typeof readAdminAuthConfiguration>>;
  auth: ReturnType<typeof createAdminAuth>;
};

type ProjectData = {
  tasks: WorkspaceTask[];
  taskNextToken: string | null;
  assignments?: WorkspaceAssignment[];
  assignmentNextToken: string | null;
  pendingTime: WorkspaceTimeEntry[];
  pendingNextToken: string | null;
};

export function Workspace() {
  useEffect(() => {
    document.title = "Project workspace | Third Down Technologies | Development preview";
  }, []);

  const [setup] = useState<WorkspaceSetup | undefined>(() => {
    const configuration = readAdminAuthConfiguration(import.meta.env, window.location.origin);
    return configuration ? { configuration, auth: createAdminAuth(configuration) } : undefined;
  });
  const [accessToken, setAccessToken] = useState<string>();
  const uatRequested = import.meta.env.DEV
    && import.meta.env.VITE_ENABLE_UAT_REHEARSAL === "1"
    && isLoopbackHostname(window.location.hostname)
    && new URLSearchParams(window.location.search).get("uatRehearsal") === "1";
  const [uatClient, setUatClient] = useState<
    (RehearsalWorkspaceClient & { prepareConflict(): void }) | undefined
  >();
  const [rehearsalRevision, setRehearsalRevision] = useState(0);
  const workspaceClient = useMemo<WorkspaceClient | undefined>(() => uatClient
    ?? (setup && accessToken ? createAuthenticatedWorkspaceClient(setup.configuration, accessToken) : undefined),
  [accessToken, setup, uatClient]);
  const [userId, setUserId] = useState<string>();
  const [projects, setProjects] = useState<WorkspaceProject[]>([]);
  const [projectsNextToken, setProjectsNextToken] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string>();
  const [projectData, setProjectData] = useState<ProjectData>();
  const [timeEntries, setTimeEntries] = useState<WorkspaceTimeEntry[]>([]);
  const [timeNextToken, setTimeNextToken] = useState<string | null>(null);
  const [editingTimeEntryId, setEditingTimeEntryId] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");

  function clearSensitiveState(message: string) {
    setup?.auth.clearSession();
    window.sessionStorage.removeItem(workspaceIntentKey);
    setAccessToken(undefined);
    setUserId(undefined);
    setProjects([]);
    setProjectsNextToken(null);
    setProjectId(undefined);
    setProjectData(undefined);
    setTimeEntries([]);
    setTimeNextToken(null);
    setEditingTimeEntryId(undefined);
    setBusy(false);
    setSaving(false);
    setStatus(message);
  }

  function reportError(error: unknown) {
    if (error instanceof WorkspaceRequestError && error.statusCode === 401) {
      clearSensitiveState("Your session expired. Sign in again.");
      return;
    }
    setStatus(workspaceErrorMessage(error));
  }

  useEffect(() => {
    if (!uatRequested) return;
    let active = true;
    void import("./uat-rehearsal.ts").then(({ createUatRehearsal }) => {
      if (!active) return;
      const rehearsal = createUatRehearsal();
      setUatClient(rehearsal);
      setUserId(rehearsal.currentPersona.userId);
      setStatus("Synthetic local rehearsal ready. No real authentication or live service requests are used.");
    }).catch(() => {
      if (active) setStatus("The local rehearsal could not be loaded.");
    });
    return () => { active = false; };
  }, [uatRequested]);

  useEffect(() => {
    if (uatRequested || !setup || !hasAuthorizationResponse(window.location.search)) return;
    let active = true;
    setBusy(true);
    void setup.auth.completeSignIn(window.location.href)
      .then((token) => { if (active && token) setAccessToken(token); })
      .catch((error: unknown) => {
        if (active) setStatus(error instanceof Error ? error.message : "Sign-in could not be completed.");
      })
      .finally(() => {
        if (active) window.history.replaceState(null, "", "/?workspace");
        window.sessionStorage.removeItem(workspaceIntentKey);
        if (active) setBusy(false);
      });
    return () => { active = false; };
  }, [setup, uatRequested]);

  useEffect(() => {
    if (!workspaceClient) return;
    const controller = new AbortController();
    setBusy(true);
    setProjects([]);
    setProjectId(undefined);
    setProjectData(undefined);
    setTimeEntries([]);
    setStatus("");
    void Promise.all([
      workspaceClient.request("/projects", { signal: controller.signal }),
      workspaceClient.request("/my/time-entries", { signal: controller.signal }),
      workspaceClient.request("/me", { signal: controller.signal }),
    ])
      .then(([projectResponse, timeResponse, identityResponse]) => {
        if (controller.signal.aborted) return;
        const projectPage = parseWorkspacePage(projectResponse, "projects", parseWorkspaceProject);
        const timePage = parseWorkspacePage(timeResponse, "timeEntries", parseWorkspaceTimeEntry);
        if (!isRecord(identityResponse) || typeof identityResponse.userId !== "string") {
          throw new Error("The project workspace returned an invalid response.");
        }
        setProjects(projectPage.items);
        setProjectsNextToken(projectPage.nextToken);
        setTimeEntries(timePage.items);
        setTimeNextToken(timePage.nextToken);
        setUserId(identityResponse.userId);
      })
      .catch((error: unknown) => { if (!controller.signal.aborted) reportError(error); })
      .finally(() => { if (!controller.signal.aborted) setBusy(false); });
    return () => controller.abort();
  }, [rehearsalRevision, workspaceClient]);

  useEffect(() => {
    if (!workspaceClient || !projectId) return;
    const controller = new AbortController();
    setProjectData(undefined);
    setStatus("");
    setBusy(true);
    void loadProjectData(workspaceClient, projectId, controller.signal)
      .then((data) => { if (!controller.signal.aborted) setProjectData(data); })
      .catch((error: unknown) => { if (!controller.signal.aborted) reportError(error); })
      .finally(() => { if (!controller.signal.aborted) setBusy(false); });
    return () => controller.abort();
  }, [projectId, rehearsalRevision, workspaceClient]);

  async function signIn() {
    if (!setup) return;
    setBusy(true);
    setStatus("");
    try {
      window.sessionStorage.setItem(workspaceIntentKey, "workspace");
      await setup.auth.beginSignIn();
    } catch (error) {
      window.sessionStorage.removeItem(workspaceIntentKey);
      setBusy(false);
      setStatus(error instanceof Error ? error.message : "Sign-in could not be started.");
    }
  }

  function selectRehearsalPersona(personaId: string) {
    if (!uatClient) return;
    try {
      uatClient.selectPersona(personaId);
      setUserId(uatClient.currentPersona.userId);
      setProjectId(undefined);
      setProjectData(undefined);
      setEditingTimeEntryId(undefined);
      setStatus(`Using synthetic ${uatClient.currentPersona.label.toLowerCase()} scope.`);
      setRehearsalRevision((revision) => revision + 1);
    } catch (error) {
      reportError(error);
    }
  }

  async function refreshWorkspace() {
    if (!workspaceClient || busy || saving) return;
    setBusy(true);
    setStatus("");
    try {
      const [projectResponse, timeResponse] = await Promise.all([
        workspaceClient.request("/projects"),
        workspaceClient.request("/my/time-entries"),
      ]);
      const projectPage = parseWorkspacePage(projectResponse, "projects", parseWorkspaceProject);
      const timePage = parseWorkspacePage(timeResponse, "timeEntries", parseWorkspaceTimeEntry);
      setProjects(projectPage.items);
      setProjectsNextToken(projectPage.nextToken);
      setTimeEntries(timePage.items);
      setTimeNextToken(timePage.nextToken);
      if (projectId) {
        setProjectData(await loadProjectData(workspaceClient, projectId));
      }
      setStatus("Workspace refreshed.");
    } catch (error) {
      reportError(error);
    } finally {
      setBusy(false);
    }
  }

  async function loadMoreProjects() {
    if (!workspaceClient || !projectsNextToken || busy || saving) return;
    setBusy(true);
    setStatus("");
    try {
      const response = await workspaceClient.request(`/projects?nextToken=${encodeURIComponent(projectsNextToken)}`);
      const page = parseWorkspacePage(response, "projects", parseWorkspaceProject);
      setProjects((current) => [...current, ...page.items]);
      setProjectsNextToken(page.nextToken);
    } catch (error) {
      reportError(error);
    } finally {
      setBusy(false);
    }
  }

  async function loadMoreProjectItems(collection: "tasks" | "assignments" | "pending-time") {
    if (!workspaceClient || !projectId || !projectData || busy || saving) return;
    const token = collection === "tasks" ? projectData.taskNextToken
      : collection === "assignments" ? projectData.assignmentNextToken
        : projectData.pendingNextToken;
    if (!token) return;
    setBusy(true);
    setStatus("");
    try {
      const suffix = collection === "pending-time" ? "pending-time" : collection;
      const response = await workspaceClient.request(
        `/projects/${encodeURIComponent(projectId)}/${suffix}?nextToken=${encodeURIComponent(token)}`,
      );
      if (collection === "tasks") {
        const page = parseWorkspacePage(response, "tasks", parseWorkspaceTask);
        setProjectData((current) => current ? {
          ...current,
          tasks: [...current.tasks, ...page.items],
          taskNextToken: page.nextToken,
        } : current);
      } else if (collection === "assignments") {
        const page = parseWorkspacePage(response, "assignments", parseWorkspaceAssignment);
        setProjectData((current) => current?.assignments ? {
          ...current,
          assignments: [...current.assignments, ...page.items],
          assignmentNextToken: page.nextToken,
        } : current);
      } else {
        const page = parseWorkspacePage(response, "timeEntries", parseWorkspaceTimeEntry);
        setProjectData((current) => current ? {
          ...current,
          pendingTime: [...current.pendingTime, ...page.items],
          pendingNextToken: page.nextToken,
        } : current);
      }
    } catch (error) {
      reportError(error);
    } finally {
      setBusy(false);
    }
  }

  async function createAssignment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!workspaceClient || !projectId || !projectData?.assignments || saving) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const user = String(form.get("userId") ?? "").trim();
    const role = String(form.get("role") ?? "");
    if (!user || (role !== "contributor" && role !== "manager")) return;
    const saved = await mutateProject(`/projects/${projectId}/assignments`, {
      method: "POST",
      body: { userId: user, role },
      successMessage: "Project assignment created.",
      validate: parseWorkspaceAssignment,
      verify: (item) => item.userId === user && item.projectId === projectId && item.role === role && item.active,
    });
    if (saved) formElement.reset();
  }

  async function createTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!workspaceClient || !projectId || !projectData?.assignments || saving) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const title = String(form.get("title") ?? "");
    const description = String(form.get("description") ?? "");
    const assignedToUserId = String(form.get("assignedToUserId") ?? "");
    const saved = await mutateProject(`/projects/${projectId}/tasks`, {
      method: "POST",
      body: { title, description, assignedToUserId },
      successMessage: "Task created.",
      validate: parseWorkspaceTask,
      verify: (item) => item.projectId === projectId && item.title === title.trim()
        && item.description === description.trim() && item.assignedToUserId === assignedToUserId
        && item.status === "TODO" && item.version === 0,
    });
    if (saved) formElement.reset();
  }

  async function updateTask(task: WorkspaceTask, nextStatus: WorkspaceTask["status"]): Promise<boolean> {
    if (!workspaceClient || saving || nextStatus === task.status || task.status === "DONE") return false;
    return mutateProject(`/projects/${task.projectId}/tasks/${task.taskId}`, {
      method: "PATCH",
      body: { status: nextStatus, expectedVersion: task.version },
      successMessage: "Task status saved.",
      validate: parseWorkspaceTask,
      verify: (item) => item.projectId === task.projectId && item.taskId === task.taskId
        && item.status === nextStatus && item.version === task.version + 1,
    });
  }

  async function createTimeDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!workspaceClient || !projectId || !projectData || !userId || saving) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const taskId = String(form.get("taskId") ?? "");
    const workDate = String(form.get("workDate") ?? "");
    const minutes = Number(form.get("minutes"));
    const description = String(form.get("description") ?? "");
    const ownTask = projectData.tasks.some((task) => task.taskId === taskId && task.assignedToUserId === userId);
    if (!ownTask) {
      setStatus("Choose a task assigned to your account.");
      return;
    }
    const saved = await mutateProject(`/projects/${projectId}/time-entries`, {
      method: "POST",
      body: { taskId, workDate, minutes, description },
      successMessage: "Time draft saved.",
      validate: parseWorkspaceTimeEntry,
      verify: (item) => item.projectId === projectId && item.taskId === taskId
        && item.workerId === userId && item.status === "DRAFT" && item.workDate === workDate
        && item.minutes === minutes && item.description === description.trim() && item.version === 0,
    });
    if (saved) formElement.reset();
  }

  async function submitTimeEntry(entry: WorkspaceTimeEntry) {
    if (!workspaceClient || saving || entry.status !== "DRAFT") return;
    await mutateProject(
      `/projects/${entry.projectId}/time-entries/${entry.timeEntryId}/submit`,
      {
        method: "POST",
        body: { expectedVersion: entry.version },
        successMessage: "Time entry submitted for review.",
        validate: parseWorkspaceTimeEntry,
        verify: (item) => item.projectId === entry.projectId && item.timeEntryId === entry.timeEntryId
          && item.status === "SUBMITTED" && item.version === entry.version + 1,
      },
    );
  }

  async function updateTimeDraft(entry: WorkspaceTimeEntry, event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!workspaceClient || saving || !userId
      || (entry.status !== "DRAFT" && entry.status !== "REJECTED")) return;
    const form = new FormData(event.currentTarget);
    const taskId = String(form.get("taskId") ?? "");
    const workDate = String(form.get("workDate") ?? "");
    const minutes = Number(form.get("minutes"));
    const description = String(form.get("description") ?? "");
    const task = projectData?.tasks.find((item) => item.taskId === taskId && item.assignedToUserId === userId);
    if (!task || projectId !== entry.projectId) {
      setStatus("Choose a task assigned to your account in this project.");
      return;
    }
    const saved = await mutateProject(`/projects/${entry.projectId}/time-entries/${entry.timeEntryId}`, {
      method: "PATCH",
      body: { taskId, workDate, minutes, description, expectedVersion: entry.version },
      successMessage: "Time draft corrected and saved.",
      validate: parseWorkspaceTimeEntry,
      verify: (item) => item.projectId === entry.projectId && item.timeEntryId === entry.timeEntryId
        && item.taskId === taskId && item.workerId === userId && item.status === "DRAFT"
        && item.version === entry.version + 1 && item.workDate === workDate
        && item.minutes === minutes && item.description === description.trim()
        && item.reviewedAt === undefined && item.reviewedBy === undefined
        && item.reviewDecision === undefined && item.reviewNote === undefined,
    });
    if (saved) setEditingTimeEntryId(undefined);
  }

  async function reviewTimeEntry(
    entry: WorkspaceTimeEntry,
    decision: "APPROVED" | "REJECTED",
    note: string,
  ) {
    if (!workspaceClient || saving || entry.status !== "SUBMITTED") return;
    await mutateProject(
      `/projects/${entry.projectId}/time-entries/${entry.timeEntryId}/review`,
      {
        method: "POST",
        body: { decision, expectedVersion: entry.version, ...(note.trim() ? { note: note.trim() } : {}) },
        successMessage: `Time entry ${decision.toLowerCase()}.`,
        validate: parseWorkspaceTimeEntry,
        verify: (item) => item.projectId === entry.projectId && item.timeEntryId === entry.timeEntryId
          && item.status === decision && item.version === entry.version + 1,
      },
    );
  }

  async function mutateProject<T>(
    path: string,
    options: {
      method: string;
      body: object;
      successMessage: string;
      validate: (value: unknown) => T;
      verify: (saved: T) => boolean;
    },
  ): Promise<boolean> {
    if (!workspaceClient) return false;
    const selectedProjectId = projectId;
    setSaving(true);
    setStatus("");
    try {
      const saved = options.validate(await workspaceClient.request(path, {
        method: options.method,
        body: options.body,
      }));
      if (!options.verify(saved)) {
        throw new Error("The project workspace returned an invalid response.");
      }
      if (selectedProjectId) {
        setProjectData(await loadProjectData(workspaceClient, selectedProjectId));
      }
      setTimeEntries(await loadOwnTimeEntries(workspaceClient));
      setStatus(options.successMessage);
      return true;
    } catch (error) {
      reportError(error);
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function loadMoreTimeEntries() {
    if (!workspaceClient || !timeNextToken || busy || saving) return;
    setBusy(true);
    setStatus("");
    try {
      const response = await workspaceClient.request(`/my/time-entries?nextToken=${encodeURIComponent(timeNextToken)}`);
      const page = parseWorkspacePage(response, "timeEntries", parseWorkspaceTimeEntry);
      setTimeEntries((current) => [...current, ...page.items]);
      setTimeNextToken(page.nextToken);
    } catch (error) {
      reportError(error);
    } finally {
      setBusy(false);
    }
  }

  const hasWorkspaceSession = accessToken !== undefined || uatClient !== undefined;

  return (
    <div className="workspace">
      <a className="workspace-skip" href="#workspace-main">Skip to workspace</a>
      <header className="workspace-header">
        <a className="workspace-brand" href="/">Third Down Technologies <span>Private workspace</span></a>
        <nav aria-label="Workspace navigation">
          <a href="/">Return to public preview</a>
          {accessToken && (
            <button type="button" className="workspace-button secondary" onClick={() => {
              clearSensitiveState("You have signed out of the project workspace.");
              setup?.auth.signOut();
            }} disabled={busy || saving}>
              Sign out
            </button>
          )}
        </nav>
      </header>
      <main id="workspace-main" className="workspace-main">
        <p className="workspace-eyebrow">Authenticated project workspace</p>
        <h1>Assigned projects</h1>
        {uatRequested && !uatClient && <p role="status">Preparing the opt-in local rehearsal...</p>}
        {uatRequested && uatClient && (
          <aside className="workspace-uat" aria-labelledby="uat-rehearsal-heading">
            <p className="workspace-eyebrow">Synthetic local rehearsal</p>
            <h2 id="uat-rehearsal-heading">NOT REAL AUTH · NOT DYNAMODB · NOT A LIVE SERVICE</h2>
            <p>All personas, records and actions stay in browser memory. No tokens, API requests or events are sent to AWS.</p>
            <label htmlFor="uat-persona">Switch synthetic role</label>
            <select
              id="uat-persona"
              value={uatClient.currentPersona.id}
              onChange={(event) => selectRehearsalPersona(event.target.value)}
            >
              {uatClient.personas.map((persona) => (
                <option value={persona.id} key={persona.id}>{persona.label}</option>
              ))}
            </select>
            <p>{uatClient.currentPersona.summary}</p>
            <button className="workspace-button secondary" type="button" onClick={() => {
              uatClient.prepareConflict();
              setStatus("A stale-version conflict is armed for the next save. No record will be changed by that attempt.");
            }} disabled={busy || saving}>
              Prepare stale-version conflict
            </button>
          </aside>
        )}
        <p className="workspace-limitations">
          You can edit your own drafts and correct rejected time. Submitted and approved entries are read-only.
          Assignment revocation, review reversal, and document upload are not available here.
        </p>
        {!hasWorkspaceSession ? (
          uatRequested ? <p role="status">Starting local rehearsal controls...</p> : !setup ? (
          <p role="status">Workspace sign-in is not configured in this build. No project data is available.</p>
          ) : (
          <>
            <p>Sign in with an active Consulting account. Project access is determined by the service for each request.</p>
            <button className="workspace-button" type="button" onClick={signIn} disabled={busy}>
              {busy ? "Signing in..." : "Sign in"}
            </button>
          </>
          )
        ) : (
          <>
            <div className="workspace-actions">
              <button className="workspace-button secondary" type="button" onClick={() => void refreshWorkspace()} disabled={busy || saving}>
                Refresh workspace
              </button>
            </div>
            <section aria-labelledby="projects-heading" className="workspace-section">
              <h2 id="projects-heading">Projects</h2>
              {busy && projects.length === 0 && <p>Loading assigned projects...</p>}
              {!busy && projects.length === 0 && <p>No assigned projects are available to this account.</p>}
              <ul className="workspace-project-list">
                {projects.map((project) => (
                  <li key={project.projectId}>
                    <button
                      type="button"
                      className={projectId === project.projectId ? "workspace-project selected" : "workspace-project"}
                      aria-pressed={projectId === project.projectId}
                      onClick={() => setProjectId(project.projectId)}
                      disabled={busy || saving}
                    >
                      <span>{project.name}</span><small>{project.status}</small>
                    </button>
                  </li>
                ))}
              </ul>
              {projectsNextToken && (
                <button className="workspace-button secondary" type="button" onClick={() => void loadMoreProjects()} disabled={busy || saving}>
                  Load more projects
                </button>
              )}
            </section>
            {projectId && (
              <ProjectPanel
                project={projects.find((item) => item.projectId === projectId)}
                projectData={projectData}
                userId={userId}
                disabled={busy || saving || !projectData}
                onReload={() => void refreshWorkspace()}
                onLoadMore={loadMoreProjectItems}
                onCreateAssignment={createAssignment}
                onCreateTask={createTask}
                onUpdateTask={updateTask}
                onCreateTimeDraft={createTimeDraft}
                onReviewTimeEntry={reviewTimeEntry}
              />
            )}
            <section aria-labelledby="my-time-heading" className="workspace-section">
              <h2 id="my-time-heading">My time</h2>
              {timeEntries.length === 0 ? <p>No time entries are available to this account.</p> : (
                <ul className="workspace-entry-list">
                  {timeEntries.map((entry) => (
                    <li key={entry.timeEntryId}>
                      <article className="workspace-card">
                        <div className="workspace-card-heading">
                          <h3>{entry.workDate} · {formatMinutes(entry.minutes)}</h3>
                          <span className={`workspace-status status-${entry.status.toLowerCase()}`}>{entry.status}</span>
                        </div>
                        <p>{entry.description}</p>
                        {entry.status === "REJECTED" && entry.reviewNote && (
                          <p><strong>Manager feedback:</strong> {entry.reviewNote}</p>
                        )}
                        {(entry.status === "DRAFT" || entry.status === "REJECTED") && (
                          <div className="workspace-inline-form">
                            {entry.status === "DRAFT" && (
                              <button
                                className="workspace-button"
                                type="button"
                                onClick={() => void submitTimeEntry(entry)}
                                disabled={busy || saving}
                              >
                                Submit for review
                              </button>
                            )}
                            <button
                              className="workspace-button secondary"
                              type="button"
                              onClick={() => {
                                setEditingTimeEntryId(entry.timeEntryId);
                                if (projectId !== entry.projectId) setProjectId(entry.projectId);
                              }}
                              disabled={busy || saving}
                            >
                              {entry.status === "REJECTED" ? "Correct rejected entry" : "Edit draft"}
                            </button>
                          </div>
                        )}
                        {editingTimeEntryId === entry.timeEntryId && (
                          projectId !== entry.projectId || !projectData
                            ? <p>Loading assigned tasks for this project...</p>
                            : <TimeEntryEditForm
                              entry={entry}
                              tasks={projectData.tasks.filter((task) => task.assignedToUserId === userId)}
                              disabled={busy || saving}
                              onSubmit={(event) => void updateTimeDraft(entry, event)}
                              onCancel={() => setEditingTimeEntryId(undefined)}
                            />
                        )}
                      </article>
                    </li>
                  ))}
                </ul>
              )}
              {timeNextToken && (
                <button className="workspace-button secondary" type="button" onClick={() => void loadMoreTimeEntries()} disabled={busy || saving}>
                  Load more time entries
                </button>
              )}
            </section>
          </>
        )}
        {busy && hasWorkspaceSession && <p>Loading workspace...</p>}
        <p className="workspace-feedback" role="status" aria-live="polite">{status}</p>
      </main>
      <footer className="workspace-footer">Project access and review permissions are checked by the service on every request.</footer>
    </div>
  );
}

function ProjectPanel({
  project,
  projectData,
  userId,
  disabled,
  onReload,
  onLoadMore,
  onCreateAssignment,
  onCreateTask,
  onUpdateTask,
  onCreateTimeDraft,
  onReviewTimeEntry,
}: {
  project: WorkspaceProject | undefined;
  projectData: ProjectData | undefined;
  userId: string | undefined;
  disabled: boolean;
  onReload: () => void;
  onLoadMore: (collection: "tasks" | "assignments" | "pending-time") => void;
  onCreateAssignment: (event: FormEvent<HTMLFormElement>) => void;
  onCreateTask: (event: FormEvent<HTMLFormElement>) => void;
  onUpdateTask: (task: WorkspaceTask, status: WorkspaceTask["status"]) => Promise<boolean>;
  onCreateTimeDraft: (event: FormEvent<HTMLFormElement>) => void;
  onReviewTimeEntry: (entry: WorkspaceTimeEntry, decision: "APPROVED" | "REJECTED", note: string) => void;
}) {
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  if (!project) return null;
  const ownTasks = projectData?.tasks.filter((task) => task.assignedToUserId === userId) ?? [];
  return (
    <section className="workspace-section" aria-labelledby="project-detail-heading">
      <div className="workspace-section-heading">
        <div><p className="workspace-eyebrow">Project detail</p><h2 id="project-detail-heading">{project.name}</h2></div>
        <button className="workspace-button secondary" type="button" onClick={onReload} disabled={disabled}>Refresh details</button>
      </div>
      {!projectData ? <p>Loading project details...</p> : (
        <>
          <p className="workspace-project-status">Status: {project.status}</p>
          <section aria-labelledby="tasks-heading" className="workspace-subsection">
            <h3 id="tasks-heading">Tasks</h3>
            {projectData.tasks.length === 0 ? <p>No tasks are available for this project.</p> : (
              <ul className="workspace-entry-list">
                {projectData.tasks.map((task) => (
                  <TaskCard
                    key={task.taskId}
                    task={task}
                    disabled={disabled}
                    showAssignee={projectData.assignments !== undefined}
                    onUpdate={onUpdateTask}
                  />
                ))}
              </ul>
            )}
            {projectData.taskNextToken && (
              <button className="workspace-button secondary" type="button" onClick={() => onLoadMore("tasks")} disabled={disabled}>
                Load more tasks
              </button>
            )}
          </section>
          {projectData.assignments && (
            <section aria-labelledby="manager-heading" className="workspace-subsection workspace-manager">
              <h3 id="manager-heading">Project management</h3>
              <p>These controls are shown only when the service confirms project-manager access.</p>
              <h4>Assignments</h4>
              <ul className="workspace-roster">
                {projectData.assignments.map((assignment) => (
                  <li key={assignment.userId}>
                    <span>{assignment.userId}</span><span>{assignment.role}</span>
                  </li>
                ))}
              </ul>
              {projectData.assignmentNextToken && (
                <button className="workspace-button secondary" type="button" onClick={() => onLoadMore("assignments")} disabled={disabled}>
                  Load more assignments
                </button>
              )}
              <form className="workspace-form" onSubmit={(event) => void onCreateAssignment(event)}>
                <h4>Add an assignment</h4>
                <label htmlFor="assignment-user">Consulting user ID</label>
                <input id="assignment-user" name="userId" autoComplete="off" required maxLength={128} pattern="[A-Za-z0-9_-]+" />
                <label htmlFor="assignment-role">Project role</label>
                <select id="assignment-role" name="role" defaultValue="contributor">
                  <option value="contributor">Contributor</option><option value="manager">Manager</option>
                </select>
                <button className="workspace-button" type="submit" disabled={disabled}>Create assignment</button>
              </form>
              <form className="workspace-form" onSubmit={(event) => void onCreateTask(event)}>
                <h4>Create a task</h4>
                <label htmlFor="task-title">Title</label>
                <input id="task-title" name="title" required maxLength={120} />
                <label htmlFor="task-description">Description</label>
                <textarea id="task-description" name="description" rows={3} maxLength={1000} />
                <label htmlFor="task-assignee">Assigned user ID</label>
                <select id="task-assignee" name="assignedToUserId" required defaultValue="">
                  <option value="" disabled>Select an active assignment</option>
                  {projectData.assignments.map((assignment) => (
                    <option key={assignment.userId} value={assignment.userId}>{assignment.userId} · {assignment.role}</option>
                  ))}
                </select>
                <button className="workspace-button" type="submit" disabled={disabled}>Create task</button>
              </form>
              <h4>Submitted time for review</h4>
              {projectData.pendingTime.length === 0 ? <p>No submitted time is awaiting review.</p> : (
                <ul className="workspace-entry-list">
                  {projectData.pendingTime.map((entry) => (
                    <li key={entry.timeEntryId}>
                      <article className="workspace-card">
                        <div className="workspace-card-heading"><h5>{entry.workDate} · {formatMinutes(entry.minutes)}</h5><span className="workspace-status">SUBMITTED</span></div>
                        <p>{entry.description}</p>
                        <p className="workspace-meta">Worker ID: {entry.workerId}</p>
                        <label htmlFor={`review-note-${entry.timeEntryId}`}>Review note (optional)</label>
                        <textarea
                          id={`review-note-${entry.timeEntryId}`}
                          rows={2}
                          maxLength={500}
                          value={reviewNotes[entry.timeEntryId] ?? ""}
                          onChange={(event) => setReviewNotes((current) => ({
                            ...current,
                            [entry.timeEntryId]: event.target.value,
                          }))}
                        />
                        <div className="workspace-inline-form">
                          <button className="workspace-button" type="button" disabled={disabled} onClick={() => {
                            onReviewTimeEntry(entry, "APPROVED", reviewNotes[entry.timeEntryId] ?? "");
                          }}>Approve</button>
                          <button className="workspace-button secondary" type="button" disabled={disabled} onClick={() => {
                            onReviewTimeEntry(entry, "REJECTED", reviewNotes[entry.timeEntryId] ?? "");
                          }}>Reject</button>
                        </div>
                      </article>
                    </li>
                  ))}
                </ul>
              )}
              {projectData.pendingNextToken && (
                <button className="workspace-button secondary" type="button" onClick={() => onLoadMore("pending-time")} disabled={disabled}>
                  Load more submitted time
                </button>
              )}
            </section>
          )}
          <section aria-labelledby="log-time-heading" className="workspace-subsection">
            <h3 id="log-time-heading">Create a time draft</h3>
            <p>Log time only to a task assigned to your account. Submitted entries are reviewed by an authorized manager.</p>
            {ownTasks.length === 0 ? <p>No assigned tasks are available for time logging.</p> : (
              <form className="workspace-form" onSubmit={(event) => void onCreateTimeDraft(event)}>
                <label htmlFor="time-task">Assigned task</label>
                <select id="time-task" name="taskId" required defaultValue="">
                  <option value="" disabled>Select your task</option>
                  {ownTasks.map((task) => <option key={task.taskId} value={task.taskId}>{task.title}</option>)}
                </select>
                <label htmlFor="time-date">Work date</label>
                <input id="time-date" name="workDate" type="date" required defaultValue={localDateString()} />
                <label htmlFor="time-minutes">Minutes (1–1440)</label>
                <input id="time-minutes" name="minutes" type="number" min={1} max={1440} required />
                <label htmlFor="time-description">Work description</label>
                <textarea id="time-description" name="description" rows={3} maxLength={500} required />
                <button className="workspace-button" type="submit" disabled={disabled}>Save draft</button>
              </form>
            )}
          </section>
        </>
      )}
    </section>
  );
}

function TaskCard({
  task,
  disabled,
  showAssignee,
  onUpdate,
}: {
  task: WorkspaceTask;
  disabled: boolean;
  showAssignee: boolean;
  onUpdate: (task: WorkspaceTask, status: WorkspaceTask["status"]) => Promise<boolean>;
}) {
  const [nextStatus, setNextStatus] = useState(task.status);
  useEffect(() => { setNextStatus(task.status); }, [task.status, task.version]);
  return (
    <li>
      <article className="workspace-card">
        <div className="workspace-card-heading"><h4>{task.title}</h4><span className="workspace-status">{task.status.replace("_", " ")}</span></div>
        {task.description && <p>{task.description}</p>}
        {showAssignee && <p className="workspace-meta">Assigned user: {task.assignedToUserId}</p>}
        <label htmlFor={`task-status-${task.taskId}`}>Task status</label>
        <div className="workspace-inline-form">
          <select
            id={`task-status-${task.taskId}`}
            value={nextStatus}
            disabled={disabled || task.status === "DONE"}
            onChange={(event) => {
              if (isTaskStatus(event.target.value)) setNextStatus(event.target.value);
            }}
          >
            {taskStatuses.map((status) => <option value={status} key={status}>{status.replace("_", " ")}</option>)}
          </select>
          <button
            className="workspace-button"
            type="button"
            disabled={disabled || task.status === "DONE" || nextStatus === task.status}
            onClick={() => {
              void onUpdate(task, nextStatus).then((saved) => {
                if (!saved) setNextStatus(task.status);
              });
            }}
          >
            Save task status
          </button>
        </div>
      </article>
    </li>
  );
}

function TimeEntryEditForm({
  entry,
  tasks,
  disabled,
  onSubmit,
  onCancel,
}: {
  entry: WorkspaceTimeEntry;
  tasks: WorkspaceTask[];
  disabled: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
}) {
  const suffix = entry.timeEntryId;
  return (
    <form className="workspace-form" onSubmit={onSubmit}>
      <h4>{entry.status === "REJECTED" ? "Correct rejected time" : "Edit time draft"}</h4>
      <label htmlFor={`time-edit-task-${suffix}`}>Assigned task to update</label>
      <select id={`time-edit-task-${suffix}`} name="taskId" required defaultValue={tasks.some((task) => task.taskId === entry.taskId) ? entry.taskId : ""}>
        <option value="" disabled>Select your task</option>
        {tasks.map((task) => <option key={task.taskId} value={task.taskId}>{task.title}</option>)}
      </select>
      <label htmlFor={`time-edit-date-${suffix}`}>Corrected work date</label>
      <input id={`time-edit-date-${suffix}`} name="workDate" type="date" required defaultValue={entry.workDate} />
      <label htmlFor={`time-edit-minutes-${suffix}`}>Corrected minutes (1–1440)</label>
      <input id={`time-edit-minutes-${suffix}`} name="minutes" type="number" min={1} max={1440} required defaultValue={entry.minutes} />
      <label htmlFor={`time-edit-description-${suffix}`}>Corrected work description</label>
      <textarea id={`time-edit-description-${suffix}`} name="description" rows={3} maxLength={500} required defaultValue={entry.description} />
      <div className="workspace-inline-form">
        <button className="workspace-button" type="submit" disabled={disabled || tasks.length === 0}>Save correction</button>
        <button className="workspace-button secondary" type="button" onClick={onCancel} disabled={disabled}>Cancel</button>
      </div>
    </form>
  );
}

async function loadProjectData(
  client: WorkspaceClient,
  projectId: string,
  signal?: AbortSignal,
): Promise<ProjectData> {
  const projectPath = `/projects/${encodeURIComponent(projectId)}`;
  const taskResponse = await client.request(`${projectPath}/tasks`, signal ? { signal } : {});
  const taskPage = parseWorkspacePage(taskResponse, "tasks", parseWorkspaceTask);
  let assignmentPage: { items: WorkspaceAssignment[]; nextToken: string | null };
  try {
    const assignmentResponse = await client.request(`${projectPath}/assignments`, signal ? { signal } : {});
    assignmentPage = parseWorkspacePage(assignmentResponse, "assignments", parseWorkspaceAssignment);
  } catch (error) {
    if (!(error instanceof WorkspaceRequestError) || error.statusCode !== 403) throw error;
    return {
      tasks: taskPage.items,
      taskNextToken: taskPage.nextToken,
      assignmentNextToken: null,
      pendingTime: [],
      pendingNextToken: null,
    };
  }
  const pendingResponse = await client.request(`${projectPath}/pending-time`, signal ? { signal } : {});
  const pendingPage = parseWorkspacePage(pendingResponse, "timeEntries", parseWorkspaceTimeEntry);
  return {
    tasks: taskPage.items,
    taskNextToken: taskPage.nextToken,
    assignments: assignmentPage.items,
    assignmentNextToken: assignmentPage.nextToken,
    pendingTime: pendingPage.items,
    pendingNextToken: pendingPage.nextToken,
  };
}

async function loadOwnTimeEntries(client: WorkspaceClient): Promise<WorkspaceTimeEntry[]> {
  const response = await client.request("/my/time-entries");
  return parseWorkspacePage(response, "timeEntries", parseWorkspaceTimeEntry).items;
}

function hasAuthorizationResponse(search: string): boolean {
  const params = new URLSearchParams(search);
  return params.has("code") || params.has("state") || params.has("error");
}

function isTaskStatus(value: string): value is WorkspaceTask["status"] {
  return taskStatuses.includes(value as WorkspaceTask["status"]);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function formatMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (hours === 0) return `${remainder} min`;
  if (remainder === 0) return `${hours} hr`;
  return `${hours} hr ${remainder} min`;
}

function localDateString(): string {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function isLoopbackHostname(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1" || hostname === "[::1]";
}

const taskStatuses: WorkspaceTask["status"][] = ["TODO", "IN_PROGRESS", "BLOCKED", "DONE"];
