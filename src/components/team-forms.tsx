"use client";

import { useSettingsAction } from "./settings-dialog";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { createInvitation, revokeInvitation, updateMember } from "@/app/settings/team/actions";
import { manageableRoles, ROLE_LABELS, MEMBER_STATES, STATE_LABELS, type TeamMember, type TeamInvitation, type TeamActionState } from "@/lib/team";
import { invitationLink } from "@/lib/invitation-session";
import type { OutreachRole } from "@/lib/access";

function Feedback({ state }: { state: TeamActionState }) {
  return <>
    {state.error && <p className="settings-feedback settings-feedback-error" role="alert">
      {state.error}
    </p>}{state.message && <p className="settings-feedback" role="status">
      {state.message}
    </p>}
  </>;
}
async function previewAction(): Promise<TeamActionState> {
  return { message: "Preview only. No invitations or access changes were saved." };
}
function InvitationCopy({ invitation }: { invitation: NonNullable<TeamActionState["invitation"]> }) {
  const [feedback, setFeedback] = useState("");
  const [copied, setCopied] = useState(false);
  const link = typeof window === "undefined" ? "" : invitationLink(window.location.origin, invitation.token) + (invitation.loginToken ? `&login=${invitation.loginToken}` : "");
  return <div className="team-copy">
    <div className="settings-field">
      <label htmlFor="new-invitation-link">Invitation link</label>
      <input id="new-invitation-link" readOnly value={link} onFocus={(event) => event.currentTarget.select()} />
    </div>
    <button type="button" className="settings-button" onClick={async () => {
      try { await navigator.clipboard.writeText(link); setCopied(true); setFeedback("Invitation link copied."); }
      catch { setCopied(false); setFeedback("Select the link above and copy it to share."); }
    }}>
      {copied ? <Check size={16} /> : <Copy size={16} />}{copied ? "Copied" : "Copy invitation link"}
    </button>
    <p className="settings-help">Copy this link before closing. It cannot be retrieved later. Expires {new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(invitation.expiresAt))} UTC.</p>
    {feedback && <p role="status" className="settings-help">
      {feedback}
    </p>}
  </div>;
}
export function InviteForm({ clientId, role, demo = false, onClose }: { clientId: string; role: OutreachRole; demo?: boolean; onClose?: () => void }) {
  const [state, action, pending] = useSettingsAction(demo ? previewAction : createInvitation, {});
  if (state.invitation) return <>
    <div className="settings-dialog-body">
      <Feedback state={state} />
      <InvitationCopy key={state.invitation.invitationId} invitation={state.invitation} />
    </div>
    <footer className="settings-dialog-footer">
      <button type="button" className="settings-button settings-button-primary" onClick={onClose}>Done</button>
    </footer>
  </>;
  return <form className="settings-form" action={action}>
    <input type="hidden" name="clientId" value={clientId} />
    <div className="settings-dialog-body">
      <div className="settings-field">
        <label htmlFor="invite-email">Email address</label>
        <input id="invite-email" name="email" type="email" autoComplete="email" required maxLength={254} placeholder="teammate@company.com" disabled={pending} autoFocus />
      </div>
      <div className="settings-field">
        <label htmlFor="invite-role">Workspace role</label>
        <select id="invite-role" name="role" defaultValue="client_member" disabled={pending}>
          {manageableRoles(role).map((value) => <option key={value} value={value}>
            {ROLE_LABELS[value]}
          </option>)}
        </select>
      </div>
      <p className="settings-help">Invite a teammate by email. New users set their password using the private link; existing users sign in. Share the link yourself; no email is sent. Accepted client teammates appear in Accounts automatically.</p>
      <p className="settings-help">A new invitation replaces any pending link for this email.</p>
      {demo && <p className="settings-preview-note">Sample workspace. This form previews an invitation.</p>}
      <Feedback state={state} />
    </div>
    <footer className="settings-dialog-footer">
      <button type="button" className="settings-button" disabled={pending} onClick={onClose}>Cancel</button>
      <button className="settings-button settings-button-primary" disabled={pending}>
        {pending ? "Creating…" : "Create invitation link"}
      </button>
    </footer>
  </form>;
}
export function MemberAccessForm({ member, role, demo = false, onClose, onSaved }: { member: TeamMember; role: OutreachRole; demo?: boolean; onClose?: () => void; onSaved?: (message: string) => void }) {
  const [state, action, pending] = useSettingsAction(demo ? previewAction : updateMember, {}, demo ? undefined : onSaved);
  const [access, setAccess] = useState(member.state);
  return <form action={action} className="settings-form">
    <input type="hidden" name="clientId" value={member.client_id} />
    <input type="hidden" name="userId" value={member.user_id} />
    <input type="hidden" name="expectedVersion" value={member.version} />
    <div className="settings-dialog-body">
      <div className="settings-field">
        <label htmlFor={`role-${member.user_id}`}>Workspace role</label>
        <select id={`role-${member.user_id}`} name="role" defaultValue={member.role} disabled={pending} autoFocus>
          {manageableRoles(role).map((value) => <option key={value} value={value}>
            {ROLE_LABELS[value]}
          </option>)}
        </select>
      </div>
      <div className="settings-field">
        <label htmlFor={`state-${member.user_id}`}>Outbound access</label>
        <select id={`state-${member.user_id}`} name="state" value={access} onChange={(event) => setAccess(event.target.value as TeamMember["state"])} disabled={pending}>
          {MEMBER_STATES.map((value) => <option key={value} value={value}>
            {STATE_LABELS[value]}
          </option>)}
        </select>
      </div>
      <div className="team-access-consequence">
        <p>
          {access === "active" ? member.state !== "active" ? "Saving Active restores access through this workspace membership." : "Role changes take effect when saved." : `Saving ${STATE_LABELS[access]} removes access through this workspace membership.`}
        </p>
        <p>Separate agency access and the Covora Outreach sign-in account stay unchanged.</p>
      </div>
      {demo && <p className="settings-preview-note">Preview only. Changes will not be saved.</p>}
      <Feedback state={state} />
    </div>
    <footer className="settings-dialog-footer">
      <button type="button" className="settings-button" disabled={pending} onClick={onClose}>Cancel</button>
      <button className="settings-button settings-button-primary" disabled={pending}>
        {pending ? "Saving…" : "Save access"}
      </button>
    </footer>
  </form>;
}
export function RevokeInvitationForm({ invitation, demo = false, onClose, onSaved }: { invitation: TeamInvitation; demo?: boolean; onClose?: () => void; onSaved?: (message: string) => void }) {
  const [state, action, pending] = useSettingsAction(demo ? previewAction : revokeInvitation, {}, demo ? undefined : onSaved);
  return <form action={action} className="settings-form">
    <input type="hidden" name="clientId" value={invitation.client_id} />
    <input type="hidden" name="invitationId" value={invitation.id} />
    <div className="settings-dialog-body">
      <p className="settings-help">This invitation link will no longer grant workspace access. Existing memberships stay unchanged.</p>
      {demo && <p className="settings-preview-note">Preview only. The sample invitation will not change.</p>}<Feedback state={state} />
    </div>
    <footer className="settings-dialog-footer">
      <button type="button" className="settings-button" disabled={pending} onClick={onClose}>Cancel</button>
      <button className="settings-button settings-button-danger" disabled={pending}>
        {pending ? "Revoking…" : "Revoke invitation"}
      </button>
    </footer>
  </form>;
}
