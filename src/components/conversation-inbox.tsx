"use client";

import { useEffect, useEffectEvent, useMemo, useRef, useState, useTransition } from "react";
import { ArrowLeft, Inbox as InboxIcon, Mail, Search, Sparkles } from "lucide-react";
import { replyTag, summarizeConversation, type ConversationSummaryResult } from "@/lib/conversation-summary";
import { changeConversationOwner, getConversation, listConversations, readConversation, sendConversationReply } from "@/app/conversation-actions";
import { canReplyInWorkspace, conversationStage, CONVERSATION_STAGES, filterConversations, conversationStatusLabel, ownerLabel, quietDays, type ConversationDetail, type ConversationFilter, type ConversationPage, type ConversationStage, type ConversationSummary, type ReplyCommand } from "@/lib/conversations";
import { beginReply, editReplyDraft, emptyReplyDraft, replyIsUnresolved, settleReply, type ReplyDraft, type ReplyOutcome } from "@/lib/reply-draft";
import { suggestFollowUp, suggestReply } from "@/lib/reply-suggestion";
import { isPreviewWorkspace, type Workspace } from "@/lib/access";
import { shortDate } from "@/lib/metrics";
import { ReplyActivity, ReplyComposer } from "./reply-composer";
import { useDemoReadState } from "./read-state";
import { SettingsTabs } from "./settings-dialog";
import { ContactAvatar, ConversationTimelineEntry } from "./conversation-presentation";
import { createInboxRefresher, INBOX_REFRESH_MS, mergeRefreshedConversations, pauseInboxRefresh } from "@/lib/inbox-refresh";
import { NewOutreach } from "./new-outreach";

const outcome = (status: ReplyCommand["status"]): ReplyOutcome => status === "sending" ? "pending" : status;
const channelName = (channel: ConversationSummary["channel"]) => channel === "email" ? "Email" : "LinkedIn";
const fullDate = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "UTC" });

function ReplyTags({ conversation, latestFromProspect, fallback }: { conversation: ConversationSummary; latestFromProspect: string | null; fallback?: string }) {
  const tag = replyTag(conversation.interest, latestFromProspect);
  return <>
    {tag ? <span className="conversation-outcome" data-tone={tag.tone}>{tag.label}</span> : fallback && <span className="conversation-outcome" data-tone="neutral">{fallback}</span>}
    {conversation.ownedByMe && <span className="conversation-outcome" data-tone="owned">You took over</span>}
  </>;
}

export function ConversationInbox({ initial, workspace, now, demo = false, preview = false, demoDetails = [], initialChannel = "all" }: { initial: ConversationPage; workspace: Workspace; now: string; demo?: boolean; preview?: boolean; demoDetails?: ConversationDetail[]; initialChannel?: ConversationFilter }) {
  const clientId = workspace.clientId!;
  const simulated = demo || preview || isPreviewWorkspace(workspace);
  const [page, setPage] = useState(initial);
  const [channel, setChannel] = useState<ConversationFilter>(initialChannel);
  const [search, setSearch] = useState("");
  const [campaign, setCampaign] = useState("");
  const [stage, setStage] = useState<ConversationStage>("needs_action");
  const [selected, setSelected] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, ConversationDetail>>(() => Object.fromEntries(demoDetails.map(item => [item.id, item])));
  const [drafts, setDrafts] = useState<Record<string, ReplyDraft>>({});
  // null marks a summary the person hid, so reopening the thread does not bring it back.
  const [summaries, setSummaries] = useState<Record<string, { latestMessageId: string | null; result: ConversationSummaryResult } | null>>({});
  const [autoDrafts, setAutoDrafts] = useState<Record<string, string>>({});
  const [discardedDrafts, setDiscardedDrafts] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [refreshRequired, setRefreshRequired] = useState<Record<string, boolean>>({});
  const [listError, setListError] = useState("");
  const [refreshError, setRefreshError] = useState(false);
  const [pending, startTransition] = useTransition();
  const heading = useRef<HTMLHeadingElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const selectionRequest = useRef(0);
  const listRequest = useRef(0);
  const demoRead = useDemoReadState();
  const active = selected ? details[selected] : undefined;
  const canWrite = canReplyInWorkspace(workspace, clientId);
  const matching = useMemo(() => filterConversations(page.conversations, { search, campaign, interest: "", status: "", unread: false }), [page, search, campaign]);
  const stageCounts = useMemo(() => matching.reduce<Record<ConversationStage, number>>((counts, item) => ({ ...counts, [conversationStage(item, now)]: counts[conversationStage(item, now)] + 1 }), { needs_action: 0, waiting: 0, follow_up: 0, meeting: 0, refused: 0, done: 0 }), [matching, now]);
  const filtered = useMemo(() => matching.filter(item => conversationStage(item, now) === stage), [matching, stage, now]);
  const stageInfo = CONVERSATION_STAGES.find(item => item.value === stage)!;
  const campaignOptions = [...new Map(page.conversations.filter(item => item.campaignName).map(item => [item.campaignId || item.campaignName, item.campaignName])).entries()];
  const clearFilters = () => { setSearch(""); setCampaign(""); };
  function applyDetail(detail: ConversationDetail) {
    setRefreshRequired(previous => ({ ...previous, [detail.id]: false }));
    setDetails(previous => ({ ...previous, [detail.id]: detail }));
    setPage(previous => ({ ...previous, conversations: previous.conversations.map(item => item.id === detail.id ? detail : item) }));
    setDrafts(previous => {
      const draft = previous[detail.id];
      const command = draft?.attempt && detail.commands.find(item => item.id === draft.attempt!.commandId);
      return draft && command ? { ...previous, [detail.id]: settleReply(draft, command.id, outcome(command.status)) } : previous;
    });
  }
  function fail(id: string, message: string) { setErrors(previous => ({ ...previous, [id]: message })); if (message) setRefreshRequired(previous => ({ ...previous, [id]: true })); }
  const refreshSnapshot = useEffectEvent(() => ({
    channel, selected, selectionRequest: selectionRequest.current, listRequest: listRequest.current,
    selectedVersion: Math.max(active?.version || 0, page.conversations.find(item => item.id === selected)?.version || 0),
    paused: pauseInboxRefresh(document.visibilityState === "visible", pending,
      Boolean(document.activeElement?.matches("input, textarea, select, [contenteditable='true']")), selected && !untouchedAutoDraft(selected) ? drafts[selected] : undefined),
  }));
  // An untouched Covora draft is replaceable, so it must not hold back new messages.
  function untouchedAutoDraft(id: string) {
    const draft = drafts[id];
    return Boolean(draft && autoDrafts[id] !== undefined && draft.text === autoDrafts[id] && !replyIsUnresolved(draft));
  }
  const acceptRefreshPage = useEffectEvent((fresh: ConversationPage) => {
    setPage(previous => mergeRefreshedConversations(previous, fresh));
    setRefreshError(false);
    setListError("");
  });
  const acceptRefreshDetail = useEffectEvent((detail: ConversationDetail) => {
    const previous = details[detail.id];
    applyDetail(detail);
    if (previous && previous.latestMessageId !== detail.latestMessageId && untouchedAutoDraft(detail.id)) {
      const text = draftFor(detail);
      setDrafts(current => ({ ...current, [detail.id]: editReplyDraft(current[detail.id] || emptyReplyDraft(), text || "") }));
      if (text) setAutoDrafts(current => ({ ...current, [detail.id]: text }));
    }
    setErrors(previous => ({ ...previous, [detail.id]: "" }));
  });
  const failRefreshDetail = useEffectEvent((id: string) => {
    fail(id, "This conversation could not be refreshed. Refresh it before replying; your draft is kept.");
  });
  useEffect(() => {
    if (simulated) return;
    const refresher = createInboxRefresher({
      snapshot: () => refreshSnapshot(),
      list: next => listConversations(clientId, next),
      detail: id => getConversation(clientId, id),
      applyPage: fresh => acceptRefreshPage(fresh),
      applyDetail: detail => acceptRefreshDetail(detail),
      detailFailed: id => failRefreshDetail(id),
      failed: () => setRefreshError(true),
    });
    const refresh = () => { void refresher.refresh(); };
    const timer = window.setInterval(refresh, INBOX_REFRESH_MS);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      refresher.dispose();
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [clientId, simulated]);
  function showConversation(id: string, markRead = true) {
    setSelected(id);
    fail(id, "");
    const request = ++selectionRequest.current;
    startTransition(async () => {
      try {
        const result = simulated ? { data: details[id] } : await getConversation(clientId, id);
        if (request !== selectionRequest.current) return;
        if (!result.data) { fail(id, result.error || "Conversation unavailable. Refresh to try again."); return; }
        let detail = result.data;
        if (markRead && detail.unread) {
          if (simulated) { demoRead.markRead(detail.messages.filter(item => item.direction === "received").map(item => item.id)); detail = { ...detail, unread: false }; }
          else {
            const read = await readConversation(clientId, id);
            if (read.ok) detail = { ...detail, unread: false };
            else fail(id, read.error || "Could not update read status. Refresh to try again.");
          }
        }
        if (request !== selectionRequest.current) return;
        applyDetail(detail);
        readThread(detail);
        requestAnimationFrame(() => heading.current?.focus());
      } catch { if (request === selectionRequest.current) fail(id, "Conversation unavailable. Refresh to try again."); }
    });
  }
  function back() {
    const previous = selected;
    ++selectionRequest.current;
    setSelected(null);
    requestAnimationFrame(() => (previous && buttons.current.get(previous) || searchInput.current)?.focus());
  }
  function loadChannel(next: ConversationFilter, more = false) {
    const request = ++listRequest.current;
    if (!more) { ++selectionRequest.current; setSelected(null); setChannel(next); setPage({ conversations: [], nextCursor: null }); clearFilters(); }
    setListError("");
    startTransition(async () => {
      try {
        const result = simulated ? { data: { conversations: Object.values(details).filter(item => next === "all" || item.channel === next), nextCursor: null } } : await listConversations(clientId, next, more ? page.nextCursor || undefined : undefined);
        if (request !== listRequest.current) return;
        if (!result.data) { setListError(result.error || "Conversations could not be loaded."); if (!more) setPage({ conversations: [], nextCursor: null }); return; }
        const nextPage = result.data;
        setPage(previous => more ? { ...nextPage, conversations: [...new Map([...previous.conversations, ...nextPage.conversations].map(item => [item.id, item])).values()] } : nextPage);
      } catch { if (request === listRequest.current) { setListError("Conversations could not be loaded. Try refreshing the list."); if (!more) setPage({ conversations: [], nextCursor: null }); } }
    });
  }
  function changeOwner(owner: "me" | "covora") {
    if (!active || pending) return;
    ++selectionRequest.current;
    const current = active;
    fail(current.id, "");
    startTransition(async () => {
      try {
        const result = simulated ? { data: { ...current, owner: owner === "me" ? { kind: "user" as const, userId: "72000000-0000-4000-8000-000000000001", name: "You" } : { kind: "covora" as const, userId: null, name: "Covora" }, ownedByMe: owner === "me", version: current.version + 1 } } : await changeConversationOwner(current.id, { clientId, expectedVersion: current.version, owner });
        if (result.data) applyDetail(result.data); else fail(current.id, result.error || "Ownership could not be updated. Refresh this conversation.");
      } catch { fail(current.id, "Ownership could not be confirmed. Refresh this conversation; your draft is still here."); }
    });
  }
  function send() {
    if (!active || pending || !canWrite || !active.canReply || !active.latestMessageId || refreshRequired[active.id]) return;
    const current = active, nextDraft = beginReply(drafts[current.id] || emptyReplyDraft(), crypto.randomUUID());
    if (!nextDraft?.attempt) return;
    ++selectionRequest.current;
    const attempt = nextDraft.attempt;
    setDrafts(previous => ({ ...previous, [current.id]: nextDraft }));
    fail(current.id, "");
    startTransition(async () => {
      try {
        const body = { clientId, commandId: attempt.commandId, expectedVersion: current.version, latestMessageId: current.latestMessageId!, bodyText: attempt.bodyText, takeover: !current.ownedByMe };
        if (simulated) {
          const timestamp = new Date().toISOString();
          const command: ReplyCommand = { id: attempt.commandId, conversationId: current.id, bodyText: attempt.bodyText, status: "sent", createdAt: timestamp, updatedAt: timestamp, actorName: "You" };
          applyDetail({ ...current, owner: { kind: "user", userId: "72000000-0000-4000-8000-000000000001", name: "You" }, ownedByMe: true, version: current.version + 1, commands: [...current.commands, command] });
          return;
        }
        const result = await sendConversationReply(current.id, body);
        if (result.data) {
          const { conversation, command } = result.data;
          applyDetail({ ...conversation, commands: [...conversation.commands.filter(item => item.id !== command.id), command] });
          const status = outcome(result.data.command.status);
          setDrafts(previous => ({ ...previous, [current.id]: settleReply(previous[current.id], attempt.commandId, status) }));
        }
        else {
          setDrafts(previous => ({ ...previous, [current.id]: settleReply(previous[current.id], attempt.commandId, result.uncertain ? "unknown" : "failed") }));
          fail(current.id, result.error || "The reply could not be confirmed. Refresh its status.");
        }
      } catch {
        setDrafts(previous => ({ ...previous, [current.id]: settleReply(previous[current.id], attempt.commandId, "unknown") }));
        fail(current.id, "The reply outcome is unknown. Refresh its status before sending again.");
      }
    });
  }
  const latestMessage = active?.messages.toSorted((a, b) => a.sentAt.localeCompare(b.sentAt)).at(-1);
  const summary = active ? summaries[active.id] ?? undefined : undefined;
  const summaryStale = Boolean(active && summary && summary.latestMessageId !== active.latestMessageId);
  const activeDraftText = active ? drafts[active.id]?.text ?? "" : "";
  const activeFollowUp = active && conversationStage(active, now) === "follow_up" ? suggestFollowUp(active.messages, active.contactName) : null;
  const draftSource =!active || autoDrafts[active.id] === undefined || !activeDraftText.trim() ? null : activeDraftText === autoDrafts[active.id] ? "auto" : "edited";
  const summaryFor = (detail: ConversationDetail) => ({ latestMessageId: detail.latestMessageId, result: summarizeConversation(detail.messages, detail.contactName) });
  /** Summary and draft run on this device only; a draft is never sent without a person pressing Send. */
  function readThread(detail: ConversationDetail) {
    setSummaries(previous => previous[detail.id] === undefined ? { ...previous, [detail.id]: summaryFor(detail) } : previous);
    if (!discardedDrafts[detail.id]) draftReply(detail, false);
  }
  /** A reply when the prospect spoke last; a follow-up once the thread is due for one. */
  function draftFor(detail: ConversationDetail) {
    return conversationStage(detail, now) === "follow_up" ? suggestFollowUp(detail.messages, detail.contactName)?.text ?? null : suggestReply(detail.messages, detail.contactName);
  }
  function draftReply(detail: ConversationDetail, replace: boolean) {
    const current = drafts[detail.id];
    if (!canWrite || !detail.canReply || (current && replyIsUnresolved(current)) || detail.commands.some(command => ["pending", "sending", "unknown"].includes(command.status))) return;
    if (!replace && current?.text.trim()) return;
    const text = draftFor(detail);
    if (!text) return;
    setDrafts(previous => ({ ...previous, [detail.id]: editReplyDraft(previous[detail.id] || emptyReplyDraft(), text) }));
    setAutoDrafts(previous => ({ ...previous, [detail.id]: text }));
    setDiscardedDrafts(previous => ({ ...previous, [detail.id]: false }));
  }
  function discardDraft(id: string) {
    setDrafts(previous => ({ ...previous, [id]: editReplyDraft(previous[id] || emptyReplyDraft(), "") }));
    setDiscardedDrafts(previous => ({ ...previous, [id]: true }));
  }
  function summarize() {
    if (!active) return;
    const current = active;
    setSummaries(previous => ({ ...previous, [current.id]: summary && !summaryStale ? null : summaryFor(current) }));
  }
  const unreadCount = filtered.filter(item => item.unread).length;
  const canReturn = Boolean(active && (active.ownedByMe || workspace.role === "agency_owner"));
  return <section className="inbox-workspace inbox-board-workspace" aria-label="Shared reply inbox">
    {simulated && <p className="inbox-notice">Sample conversations. Takeover and replies are simulated here only.</p>}
    {refreshError && <p className="inbox-notice" role="status">New conversations could not be checked. Existing conversations are still shown; automatic refresh will try again.</p>}
    <div className="inbox-toolbar">
      <label className="inbox-search"><Search size={17} aria-hidden="true" /><input ref={searchInput} aria-label="Search loaded conversations by name or address" placeholder="Search name or address" value={search} onChange={e => setSearch(e.target.value)} /></label>
      <div className="inbox-channel-switch"><SettingsTabs id="conversation-channel" label="Conversation channel" value={channel} onChange={(next) => loadChannel(next)} options={[{ value: "all", label: "All" }, { value: "email", label: "Email" }, { value: "linkedin", label: "LinkedIn" }]} /></div>
      <select className="inbox-campaign-filter" aria-label="Filter by campaign" value={campaign} onChange={event => setCampaign(event.target.value)}><option value="">All campaigns</option>{campaignOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select>
      {!simulated && canWrite && <NewOutreach clientId={clientId} onStarted={() => loadChannel(channel)} onOpenConversation={id => { setStage("waiting"); showConversation(id); }} />}
    </div>
    <div id="conversation-channel-panel" role="tabpanel" aria-labelledby={`conversation-channel-${channel}`} className="inbox-board" data-thread-open={selected ? "true" : "false"}>
      <div className="inbox-stage-tabs"><SettingsTabs id="conversation-stage" label="Conversation stage" value={stage} onChange={setStage} options={CONVERSATION_STAGES.map(item => ({ value: item.value, label: item.label, count: stageCounts[item.value] }))} /></div>
      <div className="inbox-board-columns">
        <section id="conversation-stage-panel" role="tabpanel" aria-labelledby={`conversation-stage-${stage}`} className="inbox-conversations">
          <div className="inbox-stage-summary"><p>{stageInfo.description}</p><span role="status">{filtered.length} {filtered.length === 1 ? "conversation" : "conversations"}{unreadCount ? ` · ${unreadCount} unread` : ""}{page.nextCursor ? " loaded" : ""}</span>{(search || campaign) && <button type="button" onClick={clearFilters}>Clear search and campaign</button>}</div>
          <div className="inbox-thread-scroll">{listError ? <div className="inbox-empty" role="alert"><h3>Conversations unavailable</h3><p>{listError}</p><button type="button" className="inbox-text-button" disabled={pending} onClick={() => loadChannel(channel)}>Refresh conversations</button></div> : <><ul className="inbox-thread-items">{filtered.map(item => <li key={item.id}><button type="button" className="thread-row" data-unread={item.unread} aria-current={selected === item.id ? "true" : undefined} onClick={() => showConversation(item.id)} ref={node => { if (node) buttons.current.set(item.id, node); else buttons.current.delete(item.id); }}><ContactAvatar name={item.contactName} address={item.contactAddress} channel={item.channel} /><span className="thread-row-content"><span className="thread-row-topline"><strong>{item.contactName || item.contactAddress || "Contact"}</strong><time dateTime={item.latestAt}>{shortDate(item.latestAt)}</time></span><span className="thread-row-subject">{item.unread && <span className="thread-unread-dot" role="img" aria-label="Unread" />}<span>{item.subject || "Conversation"}</span></span><span className="thread-row-preview">{item.preview || "No preview available."}</span><span className="conversation-row-meta">{conversationStage(item, now) === "follow_up" ? <span className="conversation-outcome" data-tone="question">Waiting: no reply in {quietDays(item.latestAt, now)} days</span> : <ReplyTags conversation={item} latestFromProspect={item.status === "needs_reply" ? item.preview : null} />}{item.contactAddress && item.contactAddress !== item.contactName && <span className="thread-row-address">{item.contactAddress}</span>}</span></span></button></li>)}</ul>{!filtered.length && <div className="inbox-empty inbox-empty-list"><span className="inbox-empty-icon"><InboxIcon size={24} aria-hidden="true" /></span><h3>Nothing in {stageInfo.label.toLowerCase()}</h3><p>{search || campaign ? "Try another name or campaign." : page.conversations.length ? "Conversations in other stages are in the tabs above." : "Conversations will appear here once they are synced."}</p></div>}{page.nextCursor && <p className="conversation-pagination-note">Counts, search and filters apply to loaded conversations.</p>}{page.nextCursor && <button type="button" className="conversation-load-more" disabled={pending} onClick={() => loadChannel(channel, true)}>{pending ? "Loading…" : "Load more conversations"}</button>}</>}</div>
        </section>
        <section className="inbox-reading-pane" aria-label={active ? `Conversation with ${active.contactName || "contact"}` : "Conversation detail"}>
          {selected ? active ? <>
            <header className="thread-heading">
              <button type="button" className="thread-back" onClick={back}><ArrowLeft size={17} aria-hidden="true" />All conversations</button>
              <div className="thread-heading-row">
                <h2 ref={heading} tabIndex={-1}>{active.subject || "Conversation"}</h2>
                <div className="thread-actions">
                  <button type="button" className="thread-action-secondary" aria-expanded={Boolean(summary)} aria-controls="conversation-summary" onClick={summarize}><Sparkles size={15} aria-hidden="true" />{summary && !summaryStale ? "Hide summary" : summary ? "Update summary" : "Summarize"}</button>
                  {canWrite && active.canTakeover && !active.ownedByMe && <button type="button" className="thread-action-primary" disabled={pending} onClick={() => changeOwner("me")}>Take over</button>}
                  {canWrite && active.canTakeover && active.owner.kind !== "covora" && canReturn && <button type="button" className="thread-action-secondary" disabled={pending} onClick={() => changeOwner("covora")}>Return to Covora</button>}
                </div>
              </div>
              <div className="thread-heading-meta">
                <ReplyTags conversation={active} latestFromProspect={latestMessage?.direction === "received" ? latestMessage.bodyText : null} fallback={conversationStatusLabel(active.status)} />
                <span>{channelName(active.channel)} · {active.messages.length} {active.messages.length === 1 ? "message" : "messages"} · Owner {ownerLabel(active)}</span>
              </div>
              {activeFollowUp && <p className="thread-follow-up-note">No reply for {quietDays(active.latestAt, now)} days since your last message. Covora drafted follow-up {activeFollowUp.number} below; nothing is sent until you press Send.</p>}
              <p className="thread-heading-contact">{active.contactName || "Contact"}{active.contactAddress && active.contactAddress !== active.contactName ? ` · ${active.contactAddress}` : ""}</p>
              {summary && <section id="conversation-summary" className="conversation-summary" aria-label="Conversation summary">
                <h3>Summary{summaryStale && <span> · new messages since, update to include them</span>}</h3>
                <p>
                  {summary.result.headline}
                  {summary.result.quotes.length > 0 && <> {summary.result.quoteLabel}: {summary.result.quotes.map(quote => `“${quote}”`).join(" ")}</>}
                  {summary.result.nextStep && <> <strong>Next step:</strong> {summary.result.nextStep}</>}
                </p>
                {active.messagesTruncated && <p className="conversation-summary-note">Based on the messages shown; this history is partial.</p>}
              </section>}
            </header>
            <div className="message-timeline">
              {active.messagesTruncated && <p className="inbox-notice">This history is partial. Some messages are not included.</p>}
              <ol>{active.messages.map(message => <ConversationTimelineEntry key={message.id} sender={message.senderLabel} senderName={message.direction === "received" && message.senderLabel.toLowerCase() === active.contactAddress.toLowerCase() ? active.contactName : undefined} direction={message.direction} channel={active.channel} sentAt={message.sentAt} body={message.bodyText} />)}</ol>
              <ReplyActivity conversation={active} demo={simulated} />
            </div>
            <ReplyComposer conversation={active} draft={drafts[active.id] || emptyReplyDraft()} pending={pending} refreshRequired={Boolean(refreshRequired[active.id])} error={errors[active.id]} demo={simulated} canWrite={canWrite} draftSource={draftSource} draftTitle={activeFollowUp ? `Follow-up ${activeFollowUp.number} drafted by Covora` : undefined} onChange={text => setDrafts(previous => ({ ...previous, [active.id]: editReplyDraft(previous[active.id] || emptyReplyDraft(), text) }))} onSend={send} onRefresh={() => showConversation(active.id)} onDiscard={() => discardDraft(active.id)} onRegenerate={latestMessage?.direction === "received" || activeFollowUp ? () => draftReply(active, true) : undefined} />
          </> : <div className="inbox-empty"><button type="button" className="inbox-text-button" onClick={back}>All conversations</button><h2>{pending ? "Loading conversation…" : "Conversation unavailable"}</h2>{errors[selected] && <p role="alert">{errors[selected]}</p>}<button type="button" className="inbox-text-button" disabled={pending} onClick={() => showConversation(selected)}>Refresh conversation</button></div> : <div className="inbox-empty inbox-empty-detail"><span className="inbox-empty-icon"><Mail size={30} strokeWidth={1.5} aria-hidden="true" /></span><h2>Select a conversation</h2><p>{canWrite ? "Read and reply across email and LinkedIn. Covora owns new conversations; you can take over anytime." : "Read your email and LinkedIn conversations in one place."}</p></div>}
        </section>
        <aside className="inbox-contact-panel" aria-label="Contact details">
          {active && <>
            <ContactAvatar name={active.contactName} address={active.contactAddress} size="large" />
            <h3>{active.contactName || active.contactAddress || "Contact"}</h3>
            <dl>
              {active.contactAddress && <div><dt>{active.channel === "email" ? "Email" : "LinkedIn"}</dt><dd>{active.contactAddress}</dd></div>}
              {active.campaignName && <div><dt>Campaign</dt><dd>{active.campaignName}</dd></div>}
              <div><dt>Status</dt><dd>{conversationStatusLabel(active.status)}{active.interest ? ` · ${active.interest}` : ""}</dd></div>
              <div><dt>Owner</dt><dd>{ownerLabel(active)}</dd></div>
              <div><dt>Reply as</dt><dd>{active.senderLabel || "Unavailable"}</dd></div>
              <div><dt>Latest activity</dt><dd>{Number.isFinite(Date.parse(active.latestAt)) ? `${fullDate.format(new Date(active.latestAt))} UTC` : "Unavailable"}</dd></div>
            </dl>
          </>}
        </aside>
      </div>
    </div>
  </section>;
}
