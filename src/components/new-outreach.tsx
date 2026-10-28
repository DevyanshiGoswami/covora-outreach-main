"use client";

import { useState, useTransition } from "react";
import { Send } from "lucide-react";
import { getOutreachOptions, listOutreach, startOutreach } from "@/app/outreach-actions";
import { outreachStatusLabel, type Outreach, type OutreachOptions } from "@/lib/outreach";
import { shortDate } from "@/lib/metrics";
import { SettingsDialog } from "./settings-dialog";

/** Starts one email to one existing prospect from one of the person's own connected senders. */
export function NewOutreach({ clientId, onStarted, onOpenConversation }: { clientId: string; onStarted: () => void; onOpenConversation: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<OutreachOptions | null>(null);
  const [recent, setRecent] = useState<Outreach[]>([]);
  const [form, setForm] = useState({ leadId: "", connectionId: "", subject: "", bodyText: "" });
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  // Kept after an unconfirmed outcome so a repeated press replays the same request instead of sending twice.
  const [sendId, setSendId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function load() {
    setError("");
    startTransition(async () => {
      const [loaded, history] = await Promise.all([getOutreachOptions(clientId), listOutreach(clientId)]);
      if (loaded.data) {
        setOptions(loaded.data);
        setForm(current => ({ ...current, connectionId: current.connectionId || loaded.data.senders[0]?.connectionId || "" }));
      } else setError(loaded.error || "Outreach options could not be loaded.");
      if (history.data) setRecent(history.data);
    });
  }
  function show() { setOpen(true); setNotice(""); load(); }
  function close() { if (!pending) { setOpen(false); setSendId(null); } }
  function start(event: React.FormEvent) {
    event.preventDefault();
    if (pending) return;
    const id = sendId ?? crypto.randomUUID();
    setSendId(id);
    setError("");
    setNotice("");
    startTransition(async () => {
      const result = await startOutreach({ clientId, sendId: id, ...form });
      if (result.data) {
        const started = result.data;
        setRecent(previous => [started, ...previous.filter(item => item.id !== started.id)]);
        setNotice(started.status === "failed" ? "The outreach was not sent. Check the sender connection and try again." : `${outreachStatusLabel(started.status)}: ${started.recipientEmail}. Replies appear in the Inbox.`);
        if (started.status !== "unknown") { setSendId(null); setForm(current => ({ ...current, leadId: "", subject: "", bodyText: "" })); }
        onStarted();
      } else {
        setError(result.error || "The outreach could not be started.");
        if (!result.uncertain) setSendId(null);
      }
    });
  }
  const senders = options?.senders ?? [];
  const disabled = pending || !options?.sendingEnabled || !senders.length;
  return <>
    <button type="button" className="thread-action-primary new-outreach-button" onClick={show}><Send size={15} aria-hidden="true" />New outreach</button>
    {open && <SettingsDialog title="New outreach" description="Email one existing prospect from one of your connected sender accounts." onClose={close}>
      <form className="settings-form" onSubmit={start}>
        <div className="settings-dialog-body">
          {options && !options.sendingEnabled && <p className="settings-preview-note">Starting outreach is not enabled for this workspace yet.</p>}
          {options && !senders.length && <p className="settings-preview-note">Connect your own email account in Settings before starting outreach.</p>}
          <div className="settings-field">
            <label htmlFor="outreach-prospect">Prospect</label>
            <select id="outreach-prospect" required disabled={disabled} value={form.leadId} onChange={event => setForm({ ...form, leadId: event.target.value })}>
              <option value="">Choose a prospect</option>
              {options?.prospects.map(item => <option key={item.id} value={item.id}>{[item.name, item.company].filter(Boolean).join(" · ") || item.email} ({item.email})</option>)}
            </select>
          </div>
          <div className="settings-field">
            <label htmlFor="outreach-sender">Send from</label>
            <select id="outreach-sender" required disabled={disabled} value={form.connectionId} onChange={event => setForm({ ...form, connectionId: event.target.value })}>
              {senders.map(item => <option key={item.connectionId} value={item.connectionId}>{item.label} ({item.address})</option>)}
            </select>
          </div>
          <div className="settings-field">
            <label htmlFor="outreach-subject">Subject</label>
            <input id="outreach-subject" required maxLength={500} disabled={disabled} value={form.subject} onChange={event => setForm({ ...form, subject: event.target.value.replace(/[\r\n]/g, " ") })} />
          </div>
          <div className="settings-field">
            <label htmlFor="outreach-body">Message</label>
            <textarea id="outreach-body" required rows={7} maxLength={4000} disabled={disabled} value={form.bodyText} onChange={event => setForm({ ...form, bodyText: event.target.value })} />
          </div>
          <p className="settings-help">Nothing is sent until you press Start outreach. Replies from this prospect appear in your Inbox; only you and workspace administrators can see them.</p>
          {error && <p className="settings-feedback settings-feedback-error" role="alert">{error}</p>}
          {notice && <p className="settings-feedback" role="status">{notice}</p>}
          {recent.length > 0 && <section className="outreach-recent" aria-label="Recent outreach">
            <h3>Recent outreach</h3>
            <ul>{recent.slice(0, 6).map(item => <li key={item.id}>
              <span><strong>{item.recipientName || item.recipientEmail}</strong> · {item.subject}</span>
              <span className="outreach-status" data-status={item.status}>{outreachStatusLabel(item.status)} · {shortDate(item.createdAt)}</span>
              {item.conversationId && <button type="button" className="inbox-text-button" onClick={() => { setOpen(false); onOpenConversation(item.conversationId!); }}>Open conversation</button>}
            </li>)}</ul>
          </section>}
        </div>
        <footer className="settings-dialog-footer">
          <button type="button" className="settings-button" disabled={pending} onClick={load}>Refresh status</button>
          <button type="button" className="settings-button" disabled={pending} onClick={close}>Close</button>
          <button className="settings-button settings-button-primary" disabled={disabled || !form.leadId || !form.connectionId}>{pending ? "Working…" : sendId ? "Check and start" : "Start outreach"}</button>
        </footer>
      </form>
    </SettingsDialog>}
  </>;
}
