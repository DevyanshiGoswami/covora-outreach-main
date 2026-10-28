"use client";

import { Send, RotateCcw } from "lucide-react";
import { replyBodyError, replyStatusLabel, type ConversationDetail, type ReplyInput } from "@/lib/conversations";
import { replyIsUnresolved, type ReplyDraft } from "@/lib/reply-draft";
import { unfilledPlaceholders } from "@/lib/reply-suggestion";

const receiptDate = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "UTC" });

export function ReplyActivity({ conversation, demo }: { conversation: ConversationDetail; demo: boolean }) {
  const receipts = conversation.commands.toSorted((a, b) => a.createdAt.localeCompare(b.createdAt)).slice(-5);
  if (!receipts.length) return null;
  return <section className="reply-activity" aria-label="Reply activity">
    <h3>Reply activity</h3>
    <p className="reply-activity-note">{demo ? "Sample reply receipts. No messages are sent." : "Reply receipts are separate from synced message history. Acceptance does not confirm delivery."}</p>
    {receipts.map(receipt => <article className="reply-receipt" key={receipt.id}>
      <div className="reply-receipt-header"><strong>{receipt.actorName || "Your team"}</strong><time dateTime={receipt.updatedAt}>{receiptDate.format(new Date(receipt.updatedAt))} UTC</time></div>
      <p className="reply-receipt-status" role="status">{demo ? "Sample reply saved · Not sent" : replyStatusLabel(receipt.status)}</p>
      <div className="reply-receipt-body">{receipt.bodyText}</div>
    </article>)}
  </section>;
}

export function ReplyComposer({ conversation, draft, pending, refreshRequired, error, demo, canWrite, draftSource = null, draftTitle = "Drafted by Covora", onChange, onSend, onRefresh, onDiscard, onRegenerate }: {
  conversation: ConversationDetail; draft: ReplyDraft; pending: boolean; refreshRequired: boolean; error?: string; demo: boolean; canWrite: boolean;
  draftSource?: "auto" | "edited" | null; draftTitle?: string; onChange: (text: string) => void; onSend: () => void; onRefresh: () => void; onDiscard?: () => void; onRegenerate?: () => void;
}) {
  const unresolved = replyIsUnresolved(draft) || conversation.commands.some(command => ["pending", "sending", "unknown"].includes(command.status));
  const placeholders = unfilledPlaceholders(draft.text);
  const validation = !conversation.latestMessageId ? "This conversation needs a synced message before you can reply." : placeholders.length ? `Fill in ${placeholders.join(", ")} before sending.` : replyBodyError({ clientId: conversation.clientId, commandId: "00000000-0000-4000-8000-000000000000", expectedVersion: conversation.version, latestMessageId: conversation.latestMessageId, bodyText: draft.text.trim(), takeover: !conversation.ownedByMe } satisfies ReplyInput);
  return <section className="reply-composer" aria-label="Reply to conversation">
    {error && <p className="reply-feedback reply-error" role="alert">{error}</p>}
    {unresolved && <div className="reply-feedback" role="status"><strong>Check the previous reply before sending again.</strong><p>Its outcome is still pending or unknown. Refresh to check the stored reply status. Your draft is kept if sending fails.</p></div>}
    {canWrite ? <form onSubmit={(event) => { event.preventDefault(); if (!pending && !unresolved && !refreshRequired && conversation.canReply && !validation) onSend(); }}>
      <div className="reply-composer-header">
        <label htmlFor={`reply-${conversation.id}`}>{draftSource === "auto" ? <><strong>{draftTitle}</strong> · from the whole thread</> : draftSource === "edited" ? <><strong>Covora draft, edited</strong> · reply as {conversation.senderLabel || "sender unavailable"}</> : <>Reply as <strong>{conversation.senderLabel || "Sender unavailable"}</strong> · {conversation.channel === "email" ? "Email" : "LinkedIn"}</>}</label>
        <span>{demo ? "Sample · nothing is sent" : "Not sent until you send it"}</span>
      </div>
      <textarea id={`reply-${conversation.id}`} value={draft.text} onChange={(event) => onChange(event.target.value)} rows={4} maxLength={8000} placeholder="Write your reply…" aria-describedby={`reply-note-${conversation.id}`} />
      <div className="reply-compose-footer">
        <button type="submit" className="reply-send" disabled={pending || unresolved || refreshRequired || !conversation.canReply || Boolean(validation)}><Send size={15} aria-hidden="true" />{pending ? "Working…" : demo ? "Try sample reply" : conversation.ownedByMe ? "Send" : "Take over & send"}</button>
        {draftSource && onDiscard && <button className="reply-secondary" type="button" disabled={pending} onClick={onDiscard}>Discard draft</button>}
        {onRegenerate && <button className="reply-text-action" type="button" disabled={pending || unresolved} onClick={onRegenerate}>{draftSource ? "Regenerate" : "Draft a reply"}</button>}
        <button className="reply-text-action" type="button" disabled={pending} onClick={onRefresh}><RotateCcw size={14} aria-hidden="true" />Refresh</button>
        <p id={`reply-note-${conversation.id}`}>{draft.text.trim() && validation ? validation : demo ? "Replies are simulated here only." : "Plain text · Your draft is kept if sending fails."}</p>
      </div>
      {!conversation.canReply && !unresolved && <p className="reply-unavailable">{conversation.replyUnavailableReason || "Replies are not available for this conversation yet."}</p>}
    </form> : <p className="reply-unavailable">You have read-only access to this conversation.</p>}
  </section>;
}
