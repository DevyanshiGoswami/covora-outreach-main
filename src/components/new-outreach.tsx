"use client";

import { useState, useTransition } from "react";
import { Send } from "lucide-react";
import { getOutreachOptions, listOutreach, startOutreach } from "@/app/outreach-actions";
import { outreachFormErrors, outreachOutcomeNotice, outreachStatusLabel, type Outreach, type OutreachFormErrors, type OutreachOptions } from "@/lib/outreach";
import { shortDate } from "@/lib/metrics";
import { SettingsDialog } from "./settings-dialog";

/** Starts one email to one typed recipient from one of the person's own connected senders. */
export function NewOutreach({ clientId, onStarted, onOpenConversation }: { clientId: string; onStarted: () => void; onOpenConversation: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<OutreachOptions | null>(null);
  const [recent, setRecent] = useState<Outreach[]>([]);
  const [form, setForm] = useState({ recipientEmail: "", connectionId: "", subject: "", bodyText: "" });
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<OutreachFormErrors>({});
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
  function show() { setOpen(true); setNotice(""); setFieldErrors({}); load(); }
  function edit(field: keyof typeof form, value: string) {
    setForm(current => ({ ...current, [field]: value }));
    if (field in fieldErrors) setFieldErrors(current => ({ ...current, [field]: undefined }));
  }
  function close() { if (!pending) { setOpen(false); setSendId(null); } }
  function start(event: React.FormEvent) {
    event.preventDefault();
    if (pending) return;
    const errors = outreachFormErrors(form);
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;
    const id = sendId ?? crypto.randomUUID();
    setSendId(id);
    setError("");
    setNotice("");
    startTransition(async () => {
      const result = await startOutreach({ clientId, sendId: id, recipientEmail: form.recipientEmail.trim(), connectionId: form.connectionId, subject: form.subject, bodyText: form.bodyText });
      if (result.data) {
        const started = result.data;
        setRecent(previous => [started, ...previous.filter(item => item.id !== started.id)]);
        setNotice(outreachOutcomeNotice(started));
        // Any recorded outcome ends this attempt; an unknown one is tracked through Refresh status, never resent.
        setSendId(null);
        setForm(current => ({ ...current, recipientEmail: "", subject: "", bodyText: "" }));
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
    {open && <SettingsDialog title="New outreach" description="Email one recipient from one of your connected sender accounts." onClose={close}>
      <form className="settings-form" noValidate onSubmit={start}>
        <div className="settings-dialog-body">
          {options && !options.sendingEnabled && <p className="settings-preview-note">Starting outreach is not enabled for this workspace yet.</p>}
          {options && !senders.length && <p className="settings-preview-note">Connect your own email account in Settings before starting outreach.</p>}
          <div className="settings-field">
            <label htmlFor="outreach-to">To</label>
            <input id="outreach-to" type="email" required maxLength={254} autoComplete="off" list="outreach-prospects" placeholder="name@company.com" disabled={disabled}
              aria-invalid={!!fieldErrors.recipientEmail} aria-describedby={fieldErrors.recipientEmail ? "outreach-to-error" : undefined}
              value={form.recipientEmail} onChange={event => edit("recipientEmail", event.target.value)} />
            <datalist id="outreach-prospects">
              {options?.prospects.map(item => <option key={item.id} value={item.email}>{[item.name, item.company].filter(Boolean).join(" · ")}</option>)}
            </datalist>
            {fieldErrors.recipientEmail && <small id="outreach-to-error" className="outreach-field-error">{fieldErrors.recipientEmail}</small>}
          </div>
          <div className="settings-field">
            <label htmlFor="outreach-sender">Send from</label>
            <select id="outreach-sender" required disabled={disabled} value={form.connectionId} onChange={event => edit("connectionId", event.target.value)}>
              {senders.map(item => <option key={item.connectionId} value={item.connectionId}>{item.label} ({item.address})</option>)}
            </select>
          </div>
          <div className="settings-field">
            <label htmlFor="outreach-subject">Subject</label>
            <input id="outreach-subject" required maxLength={500} disabled={disabled}
              aria-invalid={!!fieldErrors.subject} aria-describedby={fieldErrors.subject ? "outreach-subject-error" : undefined}
              value={form.subject} onChange={event => edit("subject", event.target.value.replace(/[\r\n]/g, " "))} />
            {fieldErrors.subject && <small id="outreach-subject-error" className="outreach-field-error">{fieldErrors.subject}</small>}
          </div>
          <div className="settings-field">
            <label htmlFor="outreach-body">Message</label>
            <textarea id="outreach-body" required rows={7} maxLength={4000} disabled={disabled}
              aria-invalid={!!fieldErrors.bodyText} aria-describedby={fieldErrors.bodyText ? "outreach-body-error" : undefined}
              value={form.bodyText} onChange={event => edit("bodyText", event.target.value)} />
            {fieldErrors.bodyText && <small id="outreach-body-error" className="outreach-field-error">{fieldErrors.bodyText}</small>}
          </div>
          <p className="settings-help">Nothing is sent until you press Start outreach. Replies appear in your Inbox; only you and workspace administrators can see them.</p>
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
          <button className="settings-button settings-button-primary" disabled={disabled || !form.connectionId}>{pending ? "Working…" : sendId ? "Check and start" : "Start outreach"}</button>
        </footer>
      </form>
    </SettingsDialog>}
  </>;
}
