"use client";

import { useState } from "react";
import { LockKeyhole, Plus, Search, Users } from "lucide-react";
import { isPreviewWorkspace, type Workspace } from "@/lib/access";
import { canManageTeam, canManageMember, ROLE_LABELS, STATE_LABELS, type TeamData } from "@/lib/team";
import { WorkspaceShell } from "./workspace-shell";
import { SettingsDialog, SettingsTabs } from "./settings-dialog";
import { InviteForm, MemberAccessForm, RevokeInvitationForm } from "./team-forms";

type Props = { workspace: Workspace; data: TeamData; error?: string; demo?: boolean };
type TeamDialog = { kind: "invite" } | { kind: "member" | "revoke"; id: string } | null;
export function TeamWorkspace(props: Props) {
  return <TeamContent key={props.workspace.clientId} {...props} />;
}
function TeamContent({ workspace, data, error, demo = false }: Props) {
  const [tab, setTab] = useState<"members" | "invitations">("members");
  const [query, setQuery] = useState("");
  const [dialog, setDialog] = useState<TeamDialog>(null);
  const enabled = workspace.enabled && canManageTeam(workspace.role);
  const normalized = query.trim().toLowerCase();
  const members = data.members.filter((member) => `${member.email || ""} ${ROLE_LABELS[member.role]} ${member.state}`.toLowerCase().includes(normalized));
  const invitations = data.invitations.filter((invitation) => `${invitation.email} ${ROLE_LABELS[invitation.role]} ${invitation.status}`.toLowerCase().includes(normalized));
  const selectedMember = dialog?.kind === "member" ? data.members.find((member) => member.user_id === dialog.id) : undefined;
  const selectedInvitation = dialog?.kind === "revoke" ? data.invitations.find((invitation) => invitation.id === dialog.id) : undefined;
  const [notice, setNotice] = useState("");
  const close = () => setDialog(null);
  const saved = (message: string) => { setNotice(message); close(); };
  return <WorkspaceShell workspace={workspace} active="team" title="Team" subtitle="Choose who can sign in and what they can do. Accepted client teammates also appear in Accounts." demo={demo}
    actions={enabled && !error ? <button id="team-invite" className="settings-button settings-button-primary" onClick={() => setDialog({ kind: "invite" })}>
      <Plus size={16} />Invite teammate</button> : undefined}>
    {isPreviewWorkspace(workspace) && <p className="preview-roster-note"><strong>Team access is real.</strong> Changes here affect who can enter this workspace. Sample campaign data does not change anyone’s access.</p>}
    {notice && <p className="settings-feedback" role="status">
      {notice}
    </p>}
    {!enabled || !workspace.clientId || !workspace.role ? <section className="settings-empty">
      <LockKeyhole size={24} />
      <h2>Team management is not enabled for this account.</h2>
      <p>Your workspace administrator can help with team access.</p>
    </section> : error ? <section className="settings-feedback settings-feedback-error" role="alert">
      <strong>Team access is unavailable.</strong>
      <p>
        {error}
      </p>
      <a href={`/settings/team?client=${encodeURIComponent(workspace.clientId)}`}>Reload team access</a>
    </section> : <section className="settings-page">
      <div className="settings-toolbar">
        <SettingsTabs id="team" label="Team lists" value={tab} onChange={setTab} options={[{ value: "members", label: "Members", count: data.members.length }, { value: "invitations", label: "Invitations", count: data.invitations.length }]} />
        <label className="settings-search">
          <Search size={16} />
          <span className="settings-sr-only">Search {tab}
          </span>
          <input type="search" placeholder={tab === "members" ? "Search members…" : "Search invitations…"} value={query} onChange={(event) => setQuery(event.target.value)} />
        </label>
      </div>
      <div id="team-panel" role="tabpanel" aria-labelledby={`team-${tab}`}>
        <div className="team-list-header">
          <span>Email</span>
          <span>Role</span>
          <span>
            {tab === "members" ? "Access" : "Status"}
          </span>
          <span />
        </div>
        {tab === "members" ? members.map((member) => <article className="team-row" key={member.user_id}>
          <div className="team-person">
            <span className="team-avatar" aria-hidden="true">
              {member.email?.slice(0, 1).toUpperCase() || "?"}
            </span>
            <strong>
              {member.email || "Email unavailable"}
            </strong>
          </div>
          <span className="team-role">
            {ROLE_LABELS[member.role]}
          </span>
          <span className={`settings-status settings-status-${member.state}`}>
            {STATE_LABELS[member.state]}
          </span>
          {canManageMember(workspace.role, member.role) ? <button id={`team-edit-${member.user_id}`} className="settings-row-action" aria-label={`Edit access for ${member.email || "member"}`} onClick={() => setDialog({ kind: "member", id: member.user_id })}>Edit</button> : <span className="team-managed-role" title="An agency owner manages this role">Agency managed</span>}
        </article>) : invitations.map((invitation) => <article className="team-row" key={invitation.id}>
          <div className="team-person">
            <span className="team-avatar" aria-hidden="true">
              {invitation.email.slice(0, 1).toUpperCase()}
            </span>
            <div>
              <strong>
                {invitation.email}
              </strong>
              <small>Expires {new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(invitation.expires_at))} UTC</small>
            </div>
          </div>
          <span className="team-role">
            {ROLE_LABELS[invitation.role]}
          </span>
          <span className={`settings-status settings-status-${invitation.status}`}>
            {invitation.status}
          </span>
          {invitation.status === "pending" && canManageMember(workspace.role, invitation.role) ? <button id={`team-revoke-${invitation.id}`} className="settings-row-action" aria-label={`Revoke invitation for ${invitation.email}`} onClick={() => setDialog({ kind: "revoke", id: invitation.id })}>Revoke</button> : <span />}
        </article>)}
        {(tab === "members" ? members.length : invitations.length) === 0 && <div className="settings-empty">
          <Users size={24} />
          <h2>
            {query ? "No matches" : tab === "members" ? "No members yet" : "No invitations yet"}
          </h2>
          <p>
            {query ? "Try another email, role, or status." : "Invite a teammate to give them workspace access."}
          </p>
        </div>}
      </div>
    </section>}
    {enabled && workspace.clientId && workspace.role && dialog?.kind === "invite" && <SettingsDialog title="Invite teammate" description="Create a private workspace invitation." returnFocusId="team-invite" onClose={close}>
      <InviteForm clientId={workspace.clientId} role={workspace.role} demo={demo} onClose={close} />
    </SettingsDialog>}
    {enabled && workspace.role && selectedMember && canManageMember(workspace.role, selectedMember.role) && <SettingsDialog title="Edit member" description={selectedMember.email || "Workspace member"} returnFocusId={`team-edit-${selectedMember.user_id}`} onClose={close}>
      <MemberAccessForm key={`${selectedMember.user_id}:${selectedMember.version}`} member={selectedMember} role={workspace.role} demo={demo} onClose={close} onSaved={saved} />
    </SettingsDialog>}
    {enabled && selectedInvitation && canManageMember(workspace.role, selectedInvitation.role) && <SettingsDialog title="Revoke invitation?" description={selectedInvitation.email} returnFocusId={`team-revoke-${selectedInvitation.id}`} onClose={close}>
      {selectedInvitation.status === "pending" ? <RevokeInvitationForm invitation={selectedInvitation} demo={demo} onClose={close} onSaved={saved} /> : <>
        <div className="settings-dialog-body">
          <p className="settings-feedback" role="status">Invitation {selectedInvitation.status}. Its status is up to date.</p>
        </div>
        <footer className="settings-dialog-footer">
          <button className="settings-button settings-button-primary" onClick={close}>Done</button>
        </footer>
      </>}
    </SettingsDialog>}
  </WorkspaceShell>;
}
