import { Mail, Network, ExternalLink, Check } from "lucide-react";
import type { Workspace } from "@/lib/access";
import type { PreviewConnection } from "@/lib/workspace-preview";
import { WorkspaceShell } from "./workspace-shell";

export function PreviewAccounts({ workspace, connections, agency = false }: { workspace: Workspace; connections: PreviewConnection[]; agency?: boolean }) {
  return <WorkspaceShell workspace={workspace} active={agency ? "agency" : "accounts"} title="Accounts" subtitle="A preview of the accounts in your outreach workspace.">
    <section className="panel preview-accounts" aria-labelledby="preview-accounts-heading">
      <div className="panel-heading"><div><h2 id="preview-accounts-heading">Your outreach accounts</h2><p className="muted">Demo connection cards for your walkthrough.</p></div><span className="app-preview">Sample connections</span></div>
      {connections.map((connection) => <article className="preview-account-row" key={connection.address}>
        <span className="preview-account-icon" aria-hidden="true">{connection.channel === "email" ? <Mail size={21} /> : <Network size={21} />}</span>
        <div className="preview-account-identity"><strong>{connection.address}</strong><span>{connection.channel === "email" ? `${connection.name} · Email` : "LinkedIn profile"}</span>{connection.profileUrl && <a href={connection.profileUrl} target="_blank" rel="noopener noreferrer">View profile<ExternalLink size={13} aria-hidden="true" /></a>}</div>
        <div className="preview-account-status"><span><Check size={13} aria-hidden="true" />Connected · demo</span><small>Illustrative status. No live connection check.</small></div>
      </article>)}
      <p className="preview-account-note">These cards demonstrate the connected-account experience. No account has been connected or verified by this preview.</p>
    </section>
  </WorkspaceShell>;
}
