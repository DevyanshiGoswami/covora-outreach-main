import type { ReactNode } from "react";
import { isPreviewWorkspace, type Workspace } from "@/lib/access";
import { WorkspaceSidebar } from "./workspace-sidebar";

export type WorkspacePage = "overview" | "campaigns" | "leads" | "inbox" | "linkedin" | "accounts" | "team" | "agency" | "comments";

export function WorkspaceShell({ workspace, active, title, subtitle, demo = false, showPreviewNotice = true, showPreviewBadge = showPreviewNotice, actions, inboxBadge, children }: {
  workspace: Workspace;
  active: WorkspacePage;
  title: string;
  subtitle?: string;
  demo?: boolean;
  showPreviewNotice?: boolean;
  showPreviewBadge?: boolean;
  actions?: ReactNode;
  inboxBadge?: ReactNode;
  children: ReactNode;
}) {
  return <div className={`app-shell app-shell-${active}`}>
    <a className="skip-link" href="#main">Skip to content</a>
    <WorkspaceSidebar key={`${workspace.clientId}:${active}`} workspace={workspace} active={active} demo={demo} inboxBadge={inboxBadge} />
    <div className="app-content">
      <header className="app-page-header">
        <div><span className="app-mobile-company">{workspace.clientName}</span><div className="app-title-row"><h1>{title}</h1>{(demo || (showPreviewBadge && isPreviewWorkspace(workspace))) && <span className="app-preview">{demo ? "Sample data" : "Preview"}</span>}</div>{subtitle && <p className="muted">{subtitle}</p>}</div>
        {actions && <div className="app-page-actions">{actions}</div>}
      </header>
      <main id="main" className="app-main" tabIndex={-1}>{showPreviewNotice && isPreviewWorkspace(workspace) && <div className="workspace-preview-banner" role="status"><strong>Preview workspace</strong><span>Sample campaign results and conversations. No messages are sent.</span></div>}{children}</main>
    </div>
  </div>;
}
