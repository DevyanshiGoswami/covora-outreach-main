"use client";

import { useSettingsAction } from "./settings-dialog";

import { usePathname, useRouter } from "next/navigation";
import { requestSetup, updateSetup } from "@/app/settings/actions";
import type { Workspace } from "@/lib/access";
import { STATUS_LABELS, allowedSetupStatuses, type SetupActionState, type SetupChannel, type SetupRequest } from "@/lib/setup";

export function SetupWorkspaceSwitcher({ workspace }: { workspace: Workspace }) {
  const router = useRouter();
  const pathname = usePathname();
  return <label className="client-switcher">
    <span>Client workspace</span>
    <select value={workspace.clientId || ""} onChange={(event) => router.push(`${pathname}?client=${encodeURIComponent(event.target.value)}`)}>
      {!workspace.clientId && <option value="">Choose a client</option>}
      {workspace.clients.map((client) => <option key={client.id} value={client.id}>
        {client.name}
      </option>)}
    </select>
  </label>;
}
function Feedback({ state }: { state: SetupActionState }) {
  return <>
    {state.error && <p className="settings-feedback settings-feedback-error" role="alert">
      {state.error}
    </p>}{state.message && <p className="settings-feedback" role="status">
      {state.message}
    </p>}
  </>;
}
async function previewRequest(): Promise<SetupActionState> {
  return { message: "Preview only. No setup request was created." };
}
async function previewUpdate(): Promise<SetupActionState> {
  return { message: "Preview only. No changes were saved." };
}
export function SetupRequestForm({ clientId, channel, demo = false, unavailable = false, onClose, onSaved }: {
  clientId: string; channel: SetupChannel; demo?: boolean; unavailable?: boolean; onClose?: () => void; onSaved?: (message: string) => void;
}) {
  const [state, action, pending] = useSettingsAction(demo ? previewRequest : requestSetup, {}, demo ? undefined : onSaved);
  const fieldId = `setup-${channel}-method`;
  return <form action={action} className="settings-form">
    <input type="hidden" name="clientId" value={clientId} />
    <input type="hidden" name="channel" value={channel} />
    <div className="settings-dialog-body">
      <div className="account-assistance" tabIndex={-1} data-initial-focus>
        <strong>Covora handles your setup</strong>
        <p>
          {channel === "email" ? "We’ll coordinate your outreach inboxes and connection setup. Your account manager will confirm the details with you." : "We’ll coordinate your LinkedIn setup and guide you through any sign-in or approval needed."}
        </p>
        <p>You’ll see progress here. If we need you to approve access, we’ll share the next step. Keep your password private.</p>
      </div>
      {channel === "email" ? <details className="account-existing-details">
        <summary>Already have outreach inboxes?</summary>
        <div className="settings-field">
          <label htmlFor={fieldId}>Existing inbox type (optional)</label>
          <select id={fieldId} name="method" disabled={pending || unavailable} defaultValue="assisted">
            <option value="assisted">Other / not sure</option>
            <option value="google_workspace">Google Workspace</option>
            <option value="microsoft">Microsoft</option>
          </select>
          <small>Covora will handle setup whichever option you choose.</small>
        </div>
      </details> : <input type="hidden" name="method" value="assisted" />}
      <p className="settings-help">This starts a setup request. Account connections and sending readiness are confirmed separately.</p>
      {demo && <p className="settings-preview-note">Sample workspace. This form previews the request process.</p>}
      <Feedback state={state} />
    </div>
    <footer className="settings-dialog-footer">
      <button type="button" className="settings-button" disabled={pending} onClick={onClose}>
        {state.message ? "Done" : "Cancel"}
      </button>
      <button className="settings-button settings-button-primary" disabled={pending || unavailable}>
        {pending ? "Requesting…" : "Request setup"}
      </button>
    </footer>
  </form>;
}
export function SetupUpdateForm({ request, demo = false, onClose, onSaved }: { request: SetupRequest; demo?: boolean; onClose?: () => void; onSaved?: (message: string) => void }) {
  const [state, action, pending] = useSettingsAction(demo ? previewUpdate : updateSetup, {}, demo ? undefined : onSaved);
  return <form action={action} className="settings-form">
    <input type="hidden" name="clientId" value={request.client_id} />
    <input type="hidden" name="requestId" value={request.id} />
    <div className="settings-dialog-body">
      <div className="settings-field">
        <label htmlFor={`status-${request.id}`}>Request status</label>
        <select id={`status-${request.id}`} name="status" defaultValue={request.status} disabled={pending} autoFocus>
          {allowedSetupStatuses(request.status).map((status) => <option key={status} value={status}>
            {STATUS_LABELS[status]}
          </option>)}
        </select>
      </div>
      <div className="settings-field">
        <label htmlFor={`note-${request.id}`}>Update for the client</label>
        <textarea id={`note-${request.id}`} name="note" defaultValue={request.note} placeholder="Explain what Covora is working on or the exact next step the client needs to take." maxLength={2000} rows={4} disabled={pending} aria-describedby={`note-help-${request.id}`} onInput={(event) => {
          const field = event.currentTarget;
          field.setCustomValidity(Array.from(field.value).length > 1000 ? "Keep your note within 1,000 characters." : "");
        }} />
        <small id={`note-help-${request.id}`}>Up to 1,000 characters. Never include passwords or private account details.</small>
      </div>
      <p className="settings-help">Closing a request does not confirm account readiness.</p>
      {demo && <p className="settings-preview-note">Preview only. Changes will not be saved.</p>}
      <Feedback state={state} />
    </div>
    <footer className="settings-dialog-footer">
      <button type="button" className="settings-button" disabled={pending} onClick={onClose}>Cancel</button>
      <button className="settings-button settings-button-primary" disabled={pending}>
        {pending ? "Saving…" : "Save update"}
      </button>
    </footer>
  </form>;
}
