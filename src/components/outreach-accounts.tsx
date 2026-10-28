"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { accountConnection, type AccountData } from "@/lib/accounts";
import { CheckAccountForm } from "./account-forms";

const date = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "UTC" });
const timestamp = (value: string) => `${date.format(new Date(value))} UTC`;
export function OutreachAccounts({ data, error, canManage, demo, now: asOf, reloadHref, onRegister }: {
  data: AccountData | null; error?: string; canManage: boolean; demo: boolean; now: number; reloadHref: string; onRegister: () => void;
}) {
  const [clock, setClock] = useState<{ basis: number; now: number } | null>(null);
  useEffect(() => {
    if (demo) return;
    const started = performance.now();
    const timer = setInterval(() => setClock({ basis: asOf, now: asOf + performance.now() - started }), 60_000);
    return () => clearInterval(timer);
  }, [asOf, demo]);
  const now = clock?.basis === asOf ? clock.now : asOf;
  return <section className="account-inboxes" aria-labelledby="account-inboxes-heading">
    <header className="account-section-header">
      <div>
        <h2 id="account-inboxes-heading">Outreach inboxes</h2>
        <p>Connection status from the latest check. Sending readiness is reviewed separately.</p>
      </div>
      {canManage && <button id="account-register" className="settings-button" disabled={Boolean(error) || !data?.verificationAvailable} onClick={onRegister}>
        <Plus size={15} aria-hidden="true" />Register inbox</button>}
    </header>
    {error || !data ? <div className="settings-feedback settings-feedback-error" role="alert">
      <strong>Outreach inboxes are unavailable.</strong>
      <p>
        {error || "Refresh to load the latest inboxes."}
      </p>
      <a href={reloadHref}>Reload inboxes</a>
    </div> : <>
      {canManage && !data.verificationAvailable && <p className="account-config-note">This workspace needs to be configured before inboxes can be registered or checked. Contact your agency administrator.</p>}
      {data.accounts.length ? <div className="account-sender-list">
        <div className="account-sender-header" data-managed={canManage}>
          <span>Inbox</span>
          <span>Connection</span>
          <span>Last checked</span>
          {canManage && <span />}
        </div>
        {data.accounts.map((account) => {
          const status = accountConnection(account, now);
          return <article className="account-sender-row" data-managed={canManage} key={account.id}>
            <div className="account-sender-identity">
              <strong>
                {account.email}
              </strong>
              {account.display_name && <span>
                {account.display_name}
              </span>}
            </div>
            <div className="account-sender-status">
              <span className={`settings-status account-status-${status.tone}`}>
                {status.label}
              </span>
              <small>
                {status.description}
              </small>
            </div>
            <div className="account-sender-dates">
              {account.last_checked_at ? <time dateTime={account.last_checked_at}>
                {timestamp(account.last_checked_at)}
              </time> : <span>Not checked</span>}
              {account.check_error && account.last_attempt_at && <small>Last attempt: <time dateTime={account.last_attempt_at}>
                {timestamp(account.last_attempt_at)}
              </time>
              </small>}
              {account.last_connected_at && account.state !== "connected" && <small>Last connected: <time dateTime={account.last_connected_at}>
                {timestamp(account.last_connected_at)}
              </time>
              </small>}
            </div>
            {canManage && <CheckAccountForm account={account} available={data.verificationAvailable} demo={demo} />}
          </article>;
        })}
      </div> : <div className="account-inboxes-empty">
        <p>No outreach inboxes registered yet.</p>
        <small>
          {canManage ? "Register an existing inbox when the workspace is configured." : "Covora will add your outreach inboxes here as setup progresses."}
        </small>
      </div>}
    </>}
  </section>;
}
