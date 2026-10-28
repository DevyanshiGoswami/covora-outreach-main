"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MessageSquare, Plus, ArrowLeft, ArrowRight, Send } from "lucide-react";
import { NavigationLink as Link } from "./navigation-link";
import { createComment, replyToComment, updateCommentStatus } from "@/app/comments/actions";
import { COMMENT_STATUSES, commentsUrl, type CommentDetail, type CommentFilter, type CommentPage, type CommentRequest, type CommentStatus } from "@/lib/comments";

const dateFormat = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Los_Angeles" });
function CommentDate({ value }: { value: string }) { return <time dateTime={value}>{dateFormat.format(new Date(value))} PT</time>; }
function Status({ status }: { status: CommentStatus }) { return <span className={`comment-status comment-status-${status}`}>{COMMENT_STATUSES[status]}</span>; }

type CommentDraft = { title: string; body: string; command: { payload: string; id: string } | null };
const emptyDraft: CommentDraft = { title: "", body: "", command: null };
function CommentForm({ clientId, requestId, onSaved, draft, saveDraft, pending, setPending }: { clientId: string; requestId?: string; onSaved: (requestId: string) => void; draft: CommentDraft; saveDraft: (draft: CommentDraft) => void; pending: boolean; setPending: (pending: boolean) => void }) {
  const [title, setTitle] = useState(draft.title), [body, setBody] = useState(draft.body);
  const [error, setError] = useState("");
  const command = useRef<CommentDraft["command"]>(draft.command);
  const prefix = requestId ? "reply" : "request";
  return <form className="comment-form" action={async (form) => {
    if (pending) return;
    const payload = JSON.stringify({ clientId, requestId, title: title.trim(), body: body.trim() });
    if (command.current?.payload !== payload) command.current = { payload, id: crypto.randomUUID() };
    saveDraft({ title, body, command: command.current });
    form.set("clientId", clientId); form.set("commandId", command.current.id);
    if (requestId) form.set("requestId", requestId);
    setError(""); setPending(true);
    try {
      const result = await (requestId ? replyToComment(form) : createComment(form));
      if (!result.requestId) setError(result.error || "We could not confirm the request. Try again with the same draft.");
      else { setTitle(""); setBody(""); command.current = null; saveDraft(emptyDraft); onSaved(result.requestId); }
    } catch { setError("We could not confirm the request. Your draft is still here. Try again with the same draft."); }
    finally { setPending(false); }
  }}>
    {!requestId && <div className="setup-field"><label htmlFor="comment-title">What would you like changed?</label><input id="comment-title" name="title" value={title} onChange={event => { setTitle(event.target.value); saveDraft({ title: event.target.value, body, command: command.current }); }} required maxLength={120} placeholder="For example, update our outreach wording" disabled={pending} /></div>}
    <div className="setup-field"><label htmlFor={`comment-${prefix}`}>{requestId ? "Add a reply" : "Details"}</label><textarea id={`comment-${prefix}`} name="body" value={body} onChange={event => { setBody(event.target.value); saveDraft({ title, body: event.target.value, command: command.current }); }} required maxLength={5000} rows={requestId ? 4 : 7} placeholder={requestId ? "Add context or ask a question…" : "Tell us what you’d like updated and where it appears in your portal."} disabled={pending} aria-describedby={`${prefix}-help`} /><span id={`${prefix}-help`} className="comment-field-help">{body.length.toLocaleString()} / 5,000 characters</span></div>
    {error && <p className="setup-feedback setup-error" role="alert">{error}</p>}
    <div className="comment-form-footer"><span className="muted">Visible to your EPM workspace and Covora team.</span><button className="primary" disabled={pending || !body.trim() || (!requestId && !title.trim())}><Send size={15} aria-hidden="true" />{pending ? "Saving…" : requestId ? "Post reply" : "Submit request"}</button></div>
  </form>;
}
function StatusForm({ clientId, request }: { clientId: string; request: CommentRequest }) {
  const [error, setError] = useState(""), [pending, setPending] = useState(false);
  return <form className="comment-status-form" action={async form => {
    form.set("clientId", clientId); form.set("requestId", request.id); form.set("expectedVersion", String(request.version));
    setError(""); setPending(true);
    try { const result = await updateCommentStatus(form); if (!result.ok) setError(result.error || "Status could not be updated."); }
    catch { setError("Status could not be confirmed. Refresh to check the latest request."); }
    finally { setPending(false); }
  }}><label htmlFor="request-status">Status</label><select id="request-status" name="status" defaultValue={request.status} disabled={pending}>{Object.entries(COMMENT_STATUSES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><button disabled={pending}>{pending ? "Saving…" : "Update"}</button>{error && <p role="alert" className="setup-feedback setup-error">{error}</p>}</form>;
}

export function CommentsWorkspace({ clientId, page, detail, query, detailError }: {
  clientId: string; page: CommentPage; detail: CommentDetail | null; query: { status: CommentFilter; offset: number; messageOffset: number; requestId: string | null }; detailError: string;
}) {
  const router = useRouter();
  const [composing, setComposing] = useState(false);
  const [saving, setSaving] = useState(false), [notice, setNotice] = useState("");
  const [drafts, setDrafts] = useState<Record<string, CommentDraft>>({});
  const conversation = useRef<HTMLElement>(null);
  const moveFocus = useRef(false);
  const focusConversation = () => { conversation.current?.focus(); conversation.current?.scrollIntoView({ block: "start", behavior: "smooth" }); };
  useEffect(() => { if (moveFocus.current) { focusConversation(); moveFocus.current = false; } }, [query.requestId, composing]);
  useEffect(() => {
    const protectDraft = (event: BeforeUnloadEvent) => { if (Object.values(drafts).some(draft => draft.title.trim() || draft.body.trim())) event.preventDefault(); };
    window.addEventListener("beforeunload", protectDraft);
    return () => window.removeEventListener("beforeunload", protectDraft);
  }, [drafts]);
  const compose = composing || (!query.requestId && page.permissions.canComment);
  const base = { status: query.status, offset: query.offset };
  return <div className="comments-workspace" onClickCapture={event => { if (saving && event.target instanceof Element && event.target.closest("a,button")) { event.preventDefault(); event.stopPropagation(); } }}>
    {notice && <p role="status" className="setup-feedback">{notice}</p>}
    <div className="comments-toolbar"><div className="comments-filters" aria-label="Filter requests">{(["all", "open", "in_progress", "resolved"] as const).map(status => <Link key={status} href={commentsUrl(clientId, { status })} aria-current={query.status === status ? "page" : undefined}>{status === "all" ? "All requests" : COMMENT_STATUSES[status]}</Link>)}</div>{page.permissions.canComment && <button className="primary" disabled={saving} onClick={() => { moveFocus.current = true; setComposing(true); if (composing) focusConversation(); }}><Plus size={16} aria-hidden="true" />New request</button>}</div>
    {!page.permissions.canComment && <p className="comment-read-only">You have view-only access. You can read requests and replies here.</p>}
    <div className="comments-grid">
      <section className="panel comments-list" aria-label="Change requests">
        <div className="panel-heading"><div><h2>Requests</h2><p className="muted">Newest requests first</p></div><span className="muted">{page.requests.length ? `${query.offset + 1}–${query.offset + page.requests.length}` : "0"}</span></div>
        {page.requests.length ? <div className="comment-request-list">{page.requests.map(request => <Link className="comment-request-link" key={request.id} href={commentsUrl(clientId, { ...base, requestId: request.id })} aria-current={query.requestId === request.id && !compose ? "page" : undefined} onClick={() => { moveFocus.current = true; setComposing(false); if (query.requestId === request.id) focusConversation(); }}><div className="comment-card-top"><Status status={request.status} /><span className="comment-replies"><MessageSquare size={14} aria-hidden="true" />{request.replyCount}<span className="sr-only"> replies</span></span></div><h3>{request.title}</h3><span className="comment-author">{request.authorName}</span><span className="comment-date">Updated <CommentDate value={request.updatedAt} /></span></Link>)}</div> : <div className="comment-empty"><MessageSquare size={28} aria-hidden="true" /><h3>{query.status === "all" ? "Start the conversation" : "No requests with this status"}</h3><p>{query.status === "all" ? "Use this space for feedback, questions, and changes you’d like us to make." : "Choose another filter to see more requests."}</p></div>}
        {(query.offset > 0 || page.hasMore) && <nav className="comment-pagination" aria-label="Request pages">{query.offset > 0 && <Link href={commentsUrl(clientId, { status: query.status, offset: query.offset - 25 })}><ArrowLeft size={14} />Previous</Link>}{page.hasMore && <Link href={commentsUrl(clientId, { status: query.status, offset: query.offset + 25 })}>Next<ArrowRight size={14} /></Link>}</nav>}
      </section>
      <section ref={conversation} tabIndex={-1} className="panel comment-conversation" aria-label={compose ? "New request" : "Request conversation"}>
        {compose ? <><div className="panel-heading"><div><h2>Tell us what you have in mind</h2><p className="muted">Share one request at a time so we can follow it through.</p></div>{composing && query.requestId && <button onClick={() => setComposing(false)}>Cancel</button>}</div><CommentForm key="new" pending={saving} setPending={setSaving} draft={drafts.new ?? emptyDraft} saveDraft={draft => { setDrafts(current => ({ ...current, new: draft })); }} clientId={clientId} onSaved={requestId => { setNotice("Your request was saved."); setComposing(false); router.push(commentsUrl(clientId, { requestId })); }} /></>
        : detailError ? <div className="comment-empty"><h2>Request unavailable</h2><p role="alert">{detailError}</p><button onClick={() => router.refresh()}>Refresh</button></div>
        : detail ? <><div className="comment-thread-heading"><Status status={detail.request.status} /><h2>{detail.request.title}</h2><p className="muted">Started by {detail.request.authorName} · <CommentDate value={detail.request.createdAt} /></p></div><div className="comment-body">{detail.request.body}</div>{page.permissions.canManage && <StatusForm key={`${detail.request.id}:${detail.request.version}`} clientId={clientId} request={detail.request} />}<div className="comment-thread-divider"><h3>Conversation</h3><span className="muted">{detail.request.replyCount} {detail.request.replyCount === 1 ? "reply" : "replies"}</span></div>{detail.messages.length ? <ol className="comment-messages">{detail.messages.map(message => <li key={message.id}><div className="comment-message-meta"><strong>{message.authorName}</strong><CommentDate value={message.createdAt} /></div><div className="comment-body">{message.body}</div></li>)}</ol> : <p className="muted">No replies yet.</p>}{(query.messageOffset > 0 || detail.hasMore) && <nav className="comment-pagination" aria-label="Reply pages">{query.messageOffset > 0 && <Link href={commentsUrl(clientId, { ...base, requestId: detail.request.id, messageOffset: query.messageOffset - 25 })}>Earlier replies</Link>}{detail.hasMore && <Link href={commentsUrl(clientId, { ...base, requestId: detail.request.id, messageOffset: query.messageOffset + 25 })}>Later replies</Link>}</nav>}{page.permissions.canComment && <CommentForm key={detail.request.id} pending={saving} setPending={setSaving} draft={drafts[detail.request.id] ?? emptyDraft} saveDraft={draft => { setDrafts(current => ({ ...current, [detail.request.id]: draft })); }} clientId={clientId} requestId={detail.request.id} onSaved={() => { setNotice("Your reply was saved."); const messageOffset = Math.floor(detail.request.replyCount / 25) * 25; router.push(commentsUrl(clientId, { ...base, requestId: detail.request.id, messageOffset })); router.refresh(); }} />}</>
        : <div className="comment-empty"><MessageSquare size={30} aria-hidden="true" /><h2>Select a request</h2><p>Open a request to read the conversation and see its status.</p></div>}
      </section>
    </div>
  </div>;
}
