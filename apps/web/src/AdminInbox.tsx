import { useEffect, useState } from "react";
import { createAdminAuth, readAdminAuthConfiguration } from "./admin-auth.ts";

type LeadRecord = {
  leadId: string;
  name: string;
  email: string;
  company: string;
  message: string;
  createdAt: string;
  consentedAt: string;
  consentPolicyVersion: string;
};

type LeadPage = { leads: LeadRecord[]; nextToken: string | null };

type InboxSetup = {
  configuration: NonNullable<ReturnType<typeof readAdminAuthConfiguration>>;
  auth: ReturnType<typeof createAdminAuth>;
};

export function AdminInbox() {
  const [setup] = useState<InboxSetup | undefined>(() => {
    const configuration = readAdminAuthConfiguration(import.meta.env, window.location.origin);
    return configuration ? { configuration, auth: createAdminAuth(configuration) } : undefined;
  });
  const [accessToken, setAccessToken] = useState<string>();
  const [page, setPage] = useState<LeadPage>();
  const [pageCursors, setPageCursors] = useState<Array<string | undefined>>([undefined]);
  const [pageIndex, setPageIndex] = useState(0);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const cursor = pageCursors[pageIndex];

  useEffect(() => {
    if (!setup || !hasAuthorizationResponse(window.location.search)) return;
    let active = true;
    setBusy(true);
    void setup.auth.completeSignIn(window.location.href)
      .then((token) => {
        if (active && token) setAccessToken(token);
      })
      .catch((error: unknown) => {
        if (active) setStatus(error instanceof Error ? error.message : "Sign-in could not be completed.");
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => { active = false; };
  }, [setup]);

  useEffect(() => {
    if (!setup || !accessToken) return;
    const controller = new AbortController();
    setPage(undefined);
    setBusy(true);
    setStatus("");
    const url = new URL("/admin/leads", setup.configuration.apiUrl);
    if (cursor) url.searchParams.set("nextToken", cursor);
    void fetch(url, {
      headers: { authorization: `Bearer ${accessToken}` },
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (response.status === 401) {
          setAccessToken(undefined);
          setPageCursors([undefined]);
          setPageIndex(0);
          setBusy(false);
          throw new Error("Your session expired. Sign in again.");
        }
        if (response.status === 403) throw new Error("This account is not in the ConsultingAdministrators group.");
        if (!response.ok) throw new Error("The lead inbox could not be loaded.");
        const body: unknown = await response.json();
        return parseLeadPage(body);
      })
      .then(setPage)
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setStatus(error instanceof Error ? error.message : "The lead inbox could not be loaded.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setBusy(false);
      });
    return () => controller.abort();
  }, [accessToken, cursor, refreshVersion, setup]);

  async function signIn() {
    if (!setup) return;
    setBusy(true);
    setStatus("");
    try {
      await setup.auth.beginSignIn();
    } catch (error) {
      setBusy(false);
      setStatus(error instanceof Error ? error.message : "Sign-in could not be started.");
    }
  }

  function nextPage() {
    if (!page?.nextToken) return;
    const nextCursors = pageCursors.slice(0, pageIndex + 1);
    nextCursors.push(page.nextToken);
    setPageCursors(nextCursors);
    setPageIndex(pageIndex + 1);
  }

  return (
    <>
      <a className="skip" href="#admin-main">Skip to inbox</a>
      <header>
        <p className="wordmark">Consulting lead inbox</p>
        <nav aria-label="Admin navigation"><a href="/">Return to preview</a></nav>
      </header>
      <main id="admin-main" className="admin-inbox">
        <p className="eyebrow">Private workspace</p>
        <h1>Lead inbox</h1>
        {!setup ? (
          <p>Administrator sign-in is not configured in this build. No lead data is available here.</p>
        ) : !accessToken ? (
          <>
            <p>Sign in with an account assigned to the ConsultingAdministrators group.</p>
            <button className="button" type="button" onClick={signIn} disabled={busy}>
              {busy ? "Signing in..." : "Sign in"}
            </button>
          </>
        ) : (
          <>
            <div className="admin-actions">
              <button className="button" type="button" onClick={() => setRefreshVersion(refreshVersion + 1)} disabled={busy}>
                Refresh
              </button>
              <button
                className="button"
                type="button"
                onClick={() => setup.auth.signOut()}
                disabled={busy}
              >
                Sign out
              </button>
            </div>
            {page && page.leads.length === 0 && <p>No inquiries on this page.</p>}
            {page && page.leads.length > 0 && (
              <div className="lead-list" aria-label="Inquiries">
                {page.leads.map((lead) => <LeadCard key={lead.leadId} lead={lead} />)}
              </div>
            )}
            <nav className="pagination" aria-label="Lead inbox pages">
              <button
                className="button"
                type="button"
                disabled={busy || pageIndex === 0}
                onClick={() => setPageIndex(pageIndex - 1)}
              >
                Previous page
              </button>
              <span>Page {pageIndex + 1}</span>
              <button
                className="button"
                type="button"
                disabled={busy || !page?.nextToken}
                onClick={nextPage}
              >
                Next page
              </button>
            </nav>
          </>
        )}
        {busy && accessToken && <p>Loading inquiries...</p>}
        <p role="status" aria-live="polite">{status}</p>
      </main>
      <footer>Inquiry details are confidential. Sign out when finished.</footer>
    </>
  );
}

function LeadCard({ lead }: { lead: LeadRecord }) {
  const createdDate = new Date(lead.createdAt);
  const dateLabel = Number.isFinite(createdDate.getTime())
    ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(createdDate)
    : lead.createdAt;
  return (
    <article className="lead-card">
      <div className="lead-card-heading">
        <h2>{lead.name}</h2>
        <time dateTime={lead.createdAt}>{dateLabel}</time>
      </div>
      <p><strong>Email:</strong> {lead.email}</p>
      {lead.company && <p><strong>Company:</strong> {lead.company}</p>}
      <p className="lead-message">{lead.message}</p>
      <p className="consent-detail">
        Consent recorded {lead.consentedAt} (policy {lead.consentPolicyVersion})
      </p>
    </article>
  );
}

function hasAuthorizationResponse(search: string): boolean {
  const params = new URLSearchParams(search);
  return params.has("code") || params.has("state") || params.has("error");
}

function parseLeadPage(value: unknown): LeadPage {
  if (!isRecord(value) || !Array.isArray(value.leads)
    || !(value.nextToken === null || typeof value.nextToken === "string")) {
    throw new Error("The lead inbox returned an invalid response.");
  }
  return {
    leads: value.leads.map(parseLeadRecord),
    nextToken: value.nextToken,
  };
}

function parseLeadRecord(value: unknown): LeadRecord {
  const fields = [
    "leadId", "name", "email", "company", "message", "createdAt", "consentedAt", "consentPolicyVersion",
  ] as const;
  if (!isRecord(value) || fields.some((field) => typeof value[field] !== "string")) {
    throw new Error("The lead inbox returned an invalid response.");
  }
  return {
    leadId: recordString(value, "leadId"),
    name: recordString(value, "name"),
    email: recordString(value, "email"),
    company: recordString(value, "company"),
    message: recordString(value, "message"),
    createdAt: recordString(value, "createdAt"),
    consentedAt: recordString(value, "consentedAt"),
    consentPolicyVersion: recordString(value, "consentPolicyVersion"),
  };
}

function recordString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== "string") throw new Error("The lead inbox returned an invalid response.");
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
