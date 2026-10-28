"use client";

import { useActionState } from "react";
import { registerAccount, checkAccountConnection } from "@/app/settings/account-actions";
import type { AccountActionState, OutreachAccount } from "@/lib/accounts";
import { useSettingsAction } from "./settings-dialog";

async function previewRegistration(): Promise<AccountActionState> {
  return { message: "Preview only. No inbox was registered or created." };
}
async function previewCheck(): Promise<AccountActionState> {
  return { message: "Preview only. No connection check was performed." };
}
export function RegisterAccountForm({ clientId, demo = false, onClose, onSaved }: {
  clientId: string; demo?: boolean; onClose: () => void; onSaved: (message: string) => void;
}) {
  const [state, action, pending] = useSettingsAction(demo ? previewRegistration : registerAccount, {}, demo ? undefined : onSaved);
  return <form action={action} className="settings-form">
    <input type="hidden" name="clientId" value={clientId} />
    <div className="settings-dialog-body">
      <div className="settings-field">
        <label htmlFor="account-email">Existing email address</label>
        <input id="account-email" name="email" type="email" autoComplete="off" maxLength={254} required disabled={pending} />
      </div>
      <div className="settings-field">
        <label htmlFor="account-display-name">Display name (optional)</label>
        <input id="account-display-name" name="displayName" maxLength={200} disabled={pending} onInput={(event) => {
          const field = event.currentTarget;
          field.setCustomValidity(Array.from(field.value.trim()).length > 100 ? "Keep the display name within 100 characters." : "");
        }} />
      </div>
      <p className="settings-help">Register an inbox that already exists for this workspace. This adds its identity to the list; it does not create a mailbox, connect an account, or confirm sending readiness.</p>
      {demo && <p className="settings-preview-note">Sample workspace. No account changes will be made.</p>}
      {state.error && <p className="settings-feedback settings-feedback-error" role="alert">
        {state.error}
      </p>}
      {state.message && <p className="settings-feedback" role="status">
        {state.message}
      </p>}
    </div>
    <footer className="settings-dialog-footer">
      <button type="button" className="settings-button" disabled={pending} onClick={onClose}>
        {state.message ? "Done" : "Cancel"}
      </button>
      <button className="settings-button settings-button-primary" disabled={pending}>
        {pending ? "Registering…" : "Register inbox"}
      </button>
    </footer>
  </form>;
}
export function CheckAccountForm({ account, available, demo = false }: { account: OutreachAccount; available: boolean; demo?: boolean }) {
  const [state, action, pending] = useActionState(demo ? previewCheck : checkAccountConnection, {});
  return <form action={action} className="account-check-form">
    <input type="hidden" name="clientId" value={account.client_id} />
    <input type="hidden" name="accountId" value={account.id} />
    <button className="settings-row-action" disabled={pending || !available} aria-label={`Check connection for ${account.email}`}>
      {pending ? "Checking…" : "Check connection"}
    </button>
    {state.error && <p className="account-check-feedback" role="alert">
      {state.error}
    </p>}
    {state.message && <p className="account-check-feedback" role="status">
      {state.message}
    </p>}
  </form>;
}
