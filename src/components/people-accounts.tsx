"use client";
import { useState } from "react";
import { Mail, Network, Plus, Search, Users, ChevronDown } from "lucide-react";
import { canManageTeam, ROLE_LABELS, STATE_LABELS } from "@/lib/team";
import type { Workspace } from "@/lib/access";
import { CONNECTION_LABELS, personChannelAction, canManageConnections, type ConnectionChannel, type OnboardingData, type OutreachPerson } from "@/lib/onboarding";
import { SettingsDialog } from "./settings-dialog";
import { DisconnectAccountDialog } from "./disconnect-account-dialog";
import { AccountConnectionDialog } from "./account-connection-dialog";
import { OnboardingForm } from "./onboarding-forms";
import { InviteForm } from "./team-forms";
import { NavigationLink } from "./navigation-link";
import { WorkspaceConnectionSummary } from './workspace-connection-summary';

export function PeopleAccounts({ workspace, data }: { workspace: Workspace; data: OnboardingData }) {
  const [dialog, setDialog] = useState<"person" | "invite" | { person: OutreachPerson; channel: ConnectionChannel; kind: "connect" | "disconnect" | "check-disconnect" } | null>(null);
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const clientId = workspace.clientId!;
  const canManage = canManageConnections(workspace, clientId);
  const canInvite = canManageTeam(workspace.role);
  const teamHref = `/settings/team?client=${encodeURIComponent(clientId)}`;
  const close = () => setDialog(null);
  const people = data.people.filter(person => `${person.name} ${person.email}`.toLowerCase().includes(query.trim().toLowerCase()));
  return <section className="account-inboxes people-accounts" aria-labelledby="people-heading">
    <header className="account-section-header">
      <div><p className="people-client-label">Client workspace · {workspace.clientName}</p><h2 id="people-heading">People and their accounts</h2><p>See who each account belongs to and what they need to do next.</p></div>
      <div className="onboarding-actions">
        {canInvite && <button id="people-invite" className="settings-button settings-button-primary" onClick={() => setDialog("invite")}><Plus size={16} aria-hidden="true" />Add user</button>}
        {canManage && <button id="person-add" className="settings-button" disabled={Boolean(data.error)} onClick={() => setDialog("person")}>Add sender only</button>}
      </div>
    </header>
    {canInvite && <div className="people-invite-guide"><p><strong>Adding someone?</strong> Create an invitation link, share it with them, and they’ll appear here after accepting. They then connect their own email or LinkedIn account.</p><NavigationLink href={teamHref}>Manage team &amp; invitations</NavigationLink></div>}
    {notice && <p className="settings-feedback" role="status">{notice}</p>}
    {data.error ? <p className="settings-feedback settings-feedback-error" role="alert">{data.error}</p> : <>
      {workspace.role === 'agency_owner' && <details className="people-client-settings">
        <summary><span><strong>Client connection settings</strong><small>Applies to everyone in {workspace.clientName}. Each person connects their own account below.</small></span><ChevronDown size={18} aria-hidden="true" /></summary>
        <div className="people-client-settings-body"><p className="settings-help">These assignments choose which agency connections this client uses. “Assigned” does not mean anyone’s email or LinkedIn account is connected.</p><WorkspaceConnectionSummary integrations={data.integrations} clientId={clientId} /></div>
      </details>}
      {!data.integrations.status.email && !data.integrations.status.linkedin && <p className="account-config-note">People can join now. A workspace connection must be enabled before they can connect an account.{workspace.role === "agency_owner" ? " Open Client connection settings above to review it." : " Ask your account manager to enable it."}</p>}
      <div className="people-list-toolbar"><h3>People in {workspace.clientName} <span className="settings-tab-count">{data.people.length}</span></h3><label className="settings-search"><Search size={16} aria-hidden="true" /><span className="settings-sr-only">Search people by name or email</span><input type="search" placeholder="Search name or email…" value={query} onChange={event => setQuery(event.target.value)} /></label></div>
      <div className="people-list-header" aria-hidden="true"><span>Person</span><span><Mail size={14} />Email</span><span><Network size={14} />LinkedIn</span></div>
      {people.map(person => <article className="people-account-row" aria-labelledby={`person-name-${person.id}`} key={person.id}>
        <div className="people-identity"><span className="people-avatar" aria-hidden="true">{person.name.trim().slice(0, 1).toUpperCase() || person.email.slice(0, 1).toUpperCase()}</span><div className="account-sender-identity"><strong id={`person-name-${person.id}`}>{person.name}{person.isSelf ? " · You" : ""}</strong><span>{person.email}</span><small>{person.source === "external" ? "Sender only · No portal login" : `${person.role ? ROLE_LABELS[person.role] : "Former teammate"} · ${person.access ? STATE_LABELS[person.access] : "No access"}`}</small>
          {person.role === "client_viewer" ? <p className="people-action-note">Reporting access only.</p>
            : person.source === "team" && person.access !== "active" ? <p className="people-action-note">Portal access is inactive. Review in Team.</p>
            : !person.canConnect && person.source === "team" && !["email", "linkedin"].every(channel => person.connections.some(connection => connection.channel === channel && connection.state === "connected")) ? <p className="people-action-note">Signs in to connect their own accounts.</p> : null}
        </div></div>
        {(["email", "linkedin"] as const).map(channel => {
          const connection = person.connections.find(c => c.channel === channel), action = personChannelAction(person, channel);
          return <div className="people-channel-cell" role="group" aria-label={`${channel === "email" ? "Email" : "LinkedIn"} account for ${person.name}`} key={channel}>
            <span className="people-channel-label" aria-hidden="true">{channel === "email" ? <Mail size={14} /> : <Network size={14} />}{channel === "email" ? "Email" : "LinkedIn"}</span>
            <div className="people-channel-controls">
              <span className={`people-channel-status ${connection?.state === "connected" ? "people-channel-connected" : connection && ["failed", "expired", "uncertain", "needs_review", "disconnect_uncertain"].includes(connection.state) ? "people-channel-attention" : ""}`}>{connection ? CONNECTION_LABELS[connection.state] : "Not connected"}</span>
              {action && <button id={`person-${person.id}-${channel}`} className={`settings-row-action people-channel-action ${action.kind === "disconnect" ? "account-disconnect-action" : ""}`} aria-label={`${action.label}${action.kind === "disconnect" ? ` ${channel === "email" ? "email" : "LinkedIn"}` : ""} for ${person.email}`} onClick={() => setDialog({ person, channel, kind: action.kind })}>{action.label === "Connect email" || action.label === "Connect LinkedIn" ? "Connect" : action.label}</button>}
            </div>
            {connection?.address && connection.state !== "disconnected" && <span className="people-channel-address">{connection.address}</span>}
          </div>;
        })}
      </article>)}
      {!people.length && <div className="settings-empty"><Users size={24} aria-hidden="true" /><h2>{query ? "No matching people" : "No people in this workspace yet"}</h2><p>{query ? "Try another name or email address." : canInvite ? "Use Add user to create an invitation. They appear here after accepting; pending invitations are in Team." : "Accepted client teammates appear here automatically."}</p></div>}
      <p className="account-list-note">Connection status belongs to the person on that row. Connected records successful setup; it does not confirm current sending health.</p>
    </>}
    {dialog === "invite" && canInvite && workspace.role && <SettingsDialog title={`Add user to ${workspace.clientName}`} description="Give this person portal access so they can connect their own accounts. A member can connect accounts; a viewer has reporting access only." returnFocusId="people-invite" onClose={close}><InviteForm clientId={clientId} role={workspace.role} onClose={close} /></SettingsDialog>}
    {dialog === "person" && canManage && <SettingsDialog title={`Add sender to ${workspace.clientName}`} description="For someone whose sending accounts you manage with their permission. This creates a sender record, not a portal login. Use Add user if they should sign in themselves." returnFocusId="person-add" onClose={close}><OnboardingForm kind="person" clientId={clientId} onClose={close} onSaved={setNotice} /></SettingsDialog>}
    {dialog && typeof dialog === "object" && (dialog.kind === "connect"
      ? <AccountConnectionDialog clientId={clientId} clientName={workspace.clientName} person={data.people.find(person => person.id === dialog.person.id) ?? dialog.person} channel={dialog.channel} configured={data.integrations.status} onClose={close} />
      : <DisconnectAccountDialog clientId={clientId} clientName={workspace.clientName} person={data.people.find(person => person.id === dialog.person.id) ?? dialog.person} channel={dialog.channel} onClose={close} onSaved={setNotice} />)}
  </section>;
}
