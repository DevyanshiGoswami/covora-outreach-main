"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { addPerson, createClientWorkspace, inviteClientAdministrator } from "@/app/settings/onboarding-actions";
import type { OnboardingActionState } from "@/lib/onboarding";
import { invitationLink } from "@/lib/invitation-session";
import { useSettingsAction } from "./settings-dialog";

export function OnboardingForm({ kind, clientId, onClose, onSaved }: {
  kind: "person" | "client" | "invite"; clientId?: string; onClose: () => void; onSaved?: (message: string) => void;
}) {
  const router = useRouter();
  const [id] = useState(() => crypto.randomUUID());
  const [copied, setCopied] = useState(false);
  const action = { person: addPerson, client: createClientWorkspace, invite: inviteClientAdministrator }[kind];
  const [state, submit, pending] = useSettingsAction<OnboardingActionState>(action, {}, kind === "invite" ? undefined : message => { router.refresh(); onSaved?.(message); onClose(); });
  const link = state.token && typeof window !== "undefined" ? invitationLink(window.location.origin, state.token) + (state.loginToken ? `&login=${encodeURIComponent(state.loginToken)}` : "") : "";
  return <form action={submit}>
    <input type="hidden" name="id" value={id} />
    <input type="hidden" name="clientId" value={clientId ?? ""} />
    <div className="settings-dialog-body">
      {state.error && <p className="settings-feedback settings-feedback-error" role="alert">{state.error}</p>}
      {state.message && <p className="settings-feedback" role="status">{state.message}</p>}
      {link ? <div className="team-copy"><label className="settings-field">Private invitation link<textarea readOnly value={link} rows={4} /></label><button type="button" className="settings-button" onClick={async () => { try { await navigator.clipboard.writeText(link); setCopied(true); } catch { setCopied(false); } }}>{copied ? "Copied" : "Copy invitation link"}</button><p className="settings-help">No email is sent automatically. Share this link only with the invited person.</p></div> : <>
        {(kind === "person" || kind === "client") && <label className="settings-field">{kind === "person" ? "Full name" : "Company name"}<input name="name" required maxLength={100} autoComplete={kind === "person" ? "name" : "organization"} /></label>}
        {(kind === "person" || kind === "invite") && <label className="settings-field">{kind === "person" ? "Email address" : "Client administrator email"}<input name="email" type="email" required maxLength={254} autoComplete="email" /></label>}
        {kind === "person" && <p className="settings-help">This adds a sender without a portal login. To give someone access and let them connect their own accounts, invite them from Team.</p>}
      </>}
    </div>
    <footer className="settings-dialog-footer"><button type="button" className="settings-button" disabled={pending} onClick={onClose}>{link ? "Done" : "Cancel"}</button>{!link && <button className="settings-button settings-button-primary" disabled={pending}>{pending ? "Saving…" : { person: "Add sender", client: "Add client", invite: "Create invitation" }[kind]}</button>}</footer>
  </form>;
}
