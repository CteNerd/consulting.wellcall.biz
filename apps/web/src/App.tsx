import { AdminInbox } from "./AdminInbox.tsx";
import { PublicSite } from "./PublicSite.tsx";
import { Workspace, workspaceIntentKey } from "./Workspace.tsx";
import "./style.css";

export function App() {
  const search = new URLSearchParams(window.location.search);
  const isAuthorizationResponse = search.has("code") || search.has("state") || search.has("error");
  const workspaceCallback = isAuthorizationResponse
    && window.sessionStorage.getItem(workspaceIntentKey) === "workspace";
  if (search.has("workspace") || workspaceCallback) return <Workspace />;
  if (search.has("admin") || search.has("code") || search.has("state") || search.has("error")) {
    return <AdminInbox />;
  }
  return <PublicSite />;
}
