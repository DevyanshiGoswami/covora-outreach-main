"use client";
import { useState } from "react";
import { removeClientWorkspace } from "@/app/settings/onboarding-actions";
import type { OnboardingActionState } from "@/lib/onboarding";
import { useSettingsAction } from "./settings-dialog";

export function RemoveClientForm({ client, onClose, onSaved }: {
  client: { id: string; name: string }; onClose: () => void; onSaved: (message: string) => void;
}) {
  const [name, setName] = useState("");
  const [state, submit, pending] = useSettingsAction<OnboardingActionState>(removeClientWorkspace, {}, message => { onSaved(message); onClose(); });
  return <form action={submit}>
    <input type="hidden" name="clientId" value={client.id} />
    <div className="settings-dialog-body">
      {state.error && <p className="settings-feedback settings-feedback-error" role="alert">{state.error}</p>}
      <p>This removes <strong>{client.name}</strong> from the portal and revokes its team access and pending invitations. Its history is retained. Other clients and agency integrations stay available.</p>
      <p>Campaigns already running in connected services must be stopped separately. Removing this client does not stop those campaigns.</p>
      <label className="settings-field">Type the client name to confirm<input name="name" value={name} onChange={event => setName(event.target.value)} required maxLength={200} autoComplete="off" spellCheck={false} /></label>
    </div>
    <footer className="settings-dialog-footer">
      <button type="button" className="settings-button" disabled={pending} onClick={onClose}>Cancel</button>
      <button className="settings-button settings-button-danger" disabled={pending || name !== client.name}>{pending ? "Removing…" : "Remove client"}</button>
    </footer>
  </form>;
}
