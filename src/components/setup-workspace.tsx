"use client";

import { useState } from "react";
import { LockKeyhole, Mail, Network, Plus } from "lucide-react";
import { canManageSetup, canRequestSetup, type Workspace } from "@/lib/access";
import { STATUS_LABELS, STATUS_DESCRIPTIONS, METHOD_LABELS, type SetupChannel, type SetupRequest } from "@/lib/setup";
import { WorkspaceShell } from "./workspace-shell";
import { SettingsDialog, SettingsTabs } from "./settings-dialog";
import { SetupRequestForm, SetupUpdateForm } from "./setup-forms";
import { canManageClientAccounts, type AccountData } from "@/lib/accounts";
import { RegisterAccountForm } from "./account-forms";
import { PeopleAccounts } from "./people-accounts";
import type { OnboardingData } from "@/lib/onboarding";
import { OutreachAccounts } from "./outreach-accounts";

type Props = { onboarding?: OnboardingData; workspace: Workspace; requests: SetupRequest[]; error?: string; accountData: AccountData | null; accountsError?: string; now: number; agency?: boolean; demo?: boolean };
export function SetupWorkspace(props: Props) {
  return <AccountsContent key={props.workspace.clientId} {...props} />;
}
function AccountsContent({ workspace, requests, error, accountData, accountsError, now, onboarding, agency = false, demo = false }: Props) {
  const [channel, setChannel] = useState<SetupChannel | "people">(onboarding ? "people" : "email");
  const [dialog, setDialog] = useState<"add" | string | null>(null);
  const selected = requests.find((request) => request.id === dialog);
  const visible = requests.filter((request) => request.channel === channel);
  const canRequest = !agency && workspace.enabled && canRequestSetup(workspace.role);
  const canUpdate = agency && canManageSetup(workspace.role);
  const canManageInboxes = agency && Boolean(workspace.clientId) && canManageClientAccounts(workspace, workspace.clientId!);
  const query = workspace.clientId ? `?client=${encodeURIComponent(workspace.clientId)}` : "";
  const reloadHref = `${agency ? "/agency/setup" : demo ? "/demo/settings" : "/settings"}${query}`;
  const [notice, setNotice] = useState("");
  const close = () => setDialog(null);
  const saved = (message: string) => { setNotice(message); close(); };
  return <WorkspaceShell workspace={workspace} active={agency ? "agency" : "accounts"} title={agency ? "Agency queue" : "Accounts"} subtitle={agency ? "Manage setup and share each client’s next step." : "Connect your outreach accounts and review this client’s setup progress."} demo={demo}
    actions={canRequest && channel !== "people" ? <button id="account-add" className="settings-button settings-button-primary" disabled={Boolean(error)} onClick={() => setDialog("add")}>
      <Plus size={16} aria-hidden="true" />Request setup</button> : undefined}>
    {notice && <p className="settings-feedback" role="status">
      {notice}
    </p>}
    {!workspace.enabled || !workspace.clientId ? <section className="settings-empty">
      <LockKeyhole size={24} />
      <h2>
        {agency ? "Agency setup access is not enabled for this account." : "Outbound access is not enabled for this account."}
      </h2>
      <p>Ask your account manager to review your workspace membership.</p>
    </section> : <section className="settings-page">
      <div className="settings-toolbar">
        <SettingsTabs id="account" label="Account channel" value={channel} onChange={setChannel} options={[
          ...(onboarding ? [{ value: "people" as const, label: "People" }] : []),
          { value: "email", label: "Email" },
          { value: "linkedin", label: "LinkedIn" },
        ]} />
      </div>
      <div id="account-panel" role="tabpanel" aria-labelledby={`account-${channel}`}>
        {channel === "people" && onboarding && <PeopleAccounts workspace={workspace} data={onboarding} />}
        {channel === "email" && <OutreachAccounts data={accountData} error={accountsError} canManage={canManageInboxes} demo={demo} now={now} reloadHref={reloadHref} onRegister={() => setDialog("register")} />}
        {channel !== "people" && <section className="account-setup-requests" aria-labelledby="account-requests-heading">
          <header className="account-section-header">
            <div>
              <h2 id="account-requests-heading">Setup requests</h2>
              <p>Covora’s progress and the next steps for your workspace.</p>
            </div>
          </header>
          {error ? <div className="settings-feedback settings-feedback-error" role="alert">
            <strong>Setup requests are unavailable.</strong>
            <p>
              {error}
            </p>
            <a href={reloadHref}>Reload requests</a>
          </div> : <div>
            <div className="account-list-header">
              <span>Setup request</span>
              <span>Status</span>
              <span>Updated</span>
              <span />
            </div>
            {visible.map((request) => <article className="account-row" key={request.id}>
              <div className="account-identity">
                <span className="account-icon">
                  {channel === "email" ? <Mail size={19} /> : <Network size={19} />}
                </span>
                <div>
                  <strong>
                    {channel === "email" ? METHOD_LABELS[request.method] : "LinkedIn account"}
                  </strong>
                  <small>Managed by Covora</small>
                  <p className="account-update-preview">
                    {request.note || STATUS_DESCRIPTIONS[request.status]}
                  </p>
                </div>
              </div>
              <span className={`settings-status settings-status-${request.status}`}>
                {STATUS_LABELS[request.status]}
              </span>
              <span className="account-date">
                {new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(request.updated_at))}<small>UTC</small>
              </span>
              <button id={`account-request-${request.id}`} className="settings-row-action" aria-label={`${canUpdate ? "Update" : "View"} ${channel === "email" ? request.method === "assisted" ? "email" : METHOD_LABELS[request.method] : "LinkedIn"} setup request`} onClick={() => setDialog(request.id)}>
                {canUpdate ? "Update" : "View"}
              </button>
            </article>)}
            {visible.length === 0 && <div className="settings-empty">
              <Mail size={24} />
              <h2>No {channel === "email" ? "email" : "LinkedIn"} setup requests</h2>
              <p>
                {canRequest ? "Request setup and Covora will coordinate the details with you." : agency ? "Requests for this workspace will appear here." : "Your workspace administrator can request setup with Covora."}
              </p>
            </div>}
            {visible.length > 0 && <p className="account-list-note">
              {visible.length} {visible.length === 1 ? "setup request" : "setup requests"} · Connections are verified separately.</p>}
          </div>}
        </section>}
      </div>
    </section>}
    {dialog === "register" && workspace.clientId && canManageInboxes && accountData?.verificationAvailable && !accountsError && <SettingsDialog title="Register existing inbox" description="Add an inbox already set up for this workspace." returnFocusId="account-register" onClose={close}>
      <RegisterAccountForm clientId={workspace.clientId} demo={demo} onClose={close} onSaved={saved} />
    </SettingsDialog>}
    {dialog === "add" && workspace.clientId && canRequest && <SettingsDialog title={channel === "email" ? "Request email setup" : "Request LinkedIn setup"} description="Have Covora take care of your outreach account setup." returnFocusId="account-add" onClose={close}>
      <SetupRequestForm clientId={workspace.clientId} channel={channel === "linkedin" ? "linkedin" : "email"} demo={demo} unavailable={Boolean(error)} onClose={close} onSaved={saved} />
    </SettingsDialog>}
    {selected && <SettingsDialog title={canUpdate ? "Update setup request" : "Setup request"} description={selected.channel === "email" ? METHOD_LABELS[selected.method] : "LinkedIn account"} returnFocusId={`account-request-${selected.id}`} onClose={close}>
      {canUpdate ? <SetupUpdateForm key={`${selected.id}:${selected.updated_at}:${selected.status}`} request={selected} demo={demo} onClose={close} onSaved={saved} /> : <>
        <div className="settings-dialog-body">
          <span className={`settings-status settings-status-${selected.status}`}>
            {STATUS_LABELS[selected.status]}
          </span>
          <p className="account-request-note">
            {selected.note || STATUS_DESCRIPTIONS[selected.status]}
          </p>
          <p className="settings-help">Managed by Covora · A closed request does not confirm account readiness.</p>
        </div>
        <footer className="settings-dialog-footer">
          <button className="settings-button settings-button-primary" onClick={close}>Done</button>
        </footer>
      </>}
    </SettingsDialog>}
  </WorkspaceShell>;
}
