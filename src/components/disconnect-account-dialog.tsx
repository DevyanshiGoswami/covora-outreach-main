"use client";
import { disconnectPerson } from "@/app/settings/onboarding-actions";
import type { ConnectionChannel, OnboardingActionState, OutreachPerson } from "@/lib/onboarding";
import { SettingsDialog, useSettingsAction } from "./settings-dialog";

export function DisconnectAccountDialog({ clientId, clientName, person, channel, onClose, onSaved }: {
  clientId: string; clientName: string; person: OutreachPerson; channel: ConnectionChannel; onClose: () => void; onSaved: (message: string) => void;
}) {
  const label = channel === "email" ? "email" : "LinkedIn";
  return <SettingsDialog title={`Disconnect ${label}`} description={`${clientName} · ${person.name}`} returnFocusId={`person-${person.id}-${channel}`} onClose={onClose}>
    <DisconnectForm clientId={clientId} person={person} channel={channel} onClose={onClose} onSaved={onSaved} />
  </SettingsDialog>;
}
function DisconnectForm({ clientId, person, channel, onClose, onSaved }: {
  clientId: string; person: OutreachPerson; channel: ConnectionChannel; onClose: () => void; onSaved: (message: string) => void;
}) {
  const connection = person.connections.find(item => item.channel === channel);
  const [result, submit, pending] = useSettingsAction<OnboardingActionState>(disconnectPerson, {}, message => { onSaved(message); onClose(); });
  const state = result.connection?.state ?? connection?.state;
  const checking = state === "disconnecting" || state === "disconnect_uncertain";
  return <form action={submit}>
    <input type="hidden" name="clientId" value={clientId} /><input type="hidden" name="connectionId" value={connection?.id ?? ""} />
    <div className="settings-dialog-body">
      <p className="disconnect-identity">{connection?.address ?? person.email}</p>
      {checking ? <p className="settings-help">We’re checking whether the service removed this account. Check status before connecting again.</p> : <>
        <p>This removes the account from this client’s outreach service. Your {channel === "email" ? "mailbox" : "LinkedIn profile"} and Covora login stay intact.</p>
        <p className="settings-help">Remove any campaign assignments first. Replies from this account will be disabled. After removal is confirmed, you can connect an account again.</p>
      </>}
      {result.error && <p className="settings-feedback settings-feedback-error" role="alert">{result.error}</p>}
    </div>
    <footer className="settings-dialog-footer"><button type="button" className="settings-button" disabled={pending} onClick={onClose}>Cancel</button>
      <button className="settings-button settings-button-danger" name="operation" value={checking ? "check-disconnect" : "disconnect"} disabled={pending || !connection?.canDisconnect}>
        {pending ? "Checking…" : checking ? "Check disconnection" : `Disconnect ${channel === "email" ? "email" : "LinkedIn"}`}
      </button></footer>
  </form>;
}
