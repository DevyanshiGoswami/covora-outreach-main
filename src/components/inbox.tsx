"use client";

import { useEffect, useId, useMemo, useRef, useState, useTransition } from "react";
import {
  ArrowLeft,
  CalendarDays,
  CheckCheck,
  ChevronDown,
  Inbox as InboxIcon,
  LockKeyhole,
  Mail,
  Search,
  SlidersHorizontal,
  ThumbsUp,
} from "lucide-react";
import { markMessagesRead } from "@/app/actions";
import { useDemoReadState } from "@/components/read-state";
import {
  filterInboxThreads,
  inboxThreads,
  type InboxThread,
} from "@/lib/inbox";
import { INTEREST_LABELS, interestLabel, shortDate } from "@/lib/metrics";
import type { ResultsData } from "@/lib/model";
import { ContactAvatar, ConversationChannel, ConversationMessageCard } from "./conversation-presentation";

const validTime = (value: string) => Number.isFinite(Date.parse(value));
const otherStatuses = Object.entries(INTEREST_LABELS).filter(
  ([value]) => value !== "1" && value !== "2",
);

export function Inbox({
  data,
  demo,
  clientId,
}: {
  data: ResultsData;
  demo: boolean;
  clientId: string | null;
}) {
  const [search, setSearch] = useState("");
  const [campaign, setCampaign] = useState("");
  const [interest, setInterest] = useState("");
  const [unread, setUnread] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [readIds, setReadIds] = useState<Set<string>>(() => new Set());
  const demoReadState = useDemoReadState();
  const confirmedReadIds = demo ? demoReadState.readIds : readIds;
  const [error, setError] = useState<{ threadId: string; text: string } | null>(
    null,
  );
  const [pending, startTransition] = useTransition();
  const filterId = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const threadButtons = useRef(new Map<string, HTMLButtonElement>());
  const allThreads = useMemo(
    () => inboxThreads(data.messages, data.leads, confirmedReadIds),
    [data.messages, data.leads, confirmedReadIds],
  );
  const filtered = useMemo(
    () =>
      filterInboxThreads(allThreads, { search, campaign, interest, unread }),
    [allThreads, search, campaign, interest, unread],
  );
  const active = allThreads.find((thread) => thread.id === selected) ?? null;
  const activeId = active?.id;
  const campaignNames = useMemo(
    () => new Map(data.campaigns.map((item) => [item.id, item.name])),
    [data.campaigns],
  );
  const campaignName = (id: string) => campaignNames.get(id) ?? "Campaign";
  const unreadCount = allThreads.filter((thread) => thread.unread).length;
  const hasFilters = Boolean(search || campaign || interest || unread);
  const statusLabel = interest
    ? interest === "unclassified"
      ? "Not classified"
      : interestLabel(Number(interest))
    : "All replies";

  useEffect(() => {
    if (activeId) headingRef.current?.focus();
  }, [activeId]);

  function confirmRead(ids: string[]) {
    if (demo) demoReadState.markRead(ids);
    else setReadIds((previous) => new Set([...previous, ...ids]));
  }

  function openThread(thread: InboxThread) {
    setSelected(thread.id);
    setError(null);
    if (!thread.unreadIds.length) return;
    if (demo) {
      confirmRead(thread.unreadIds);
      return;
    }
    if (!clientId) {
      setError({
        threadId: thread.id,
        text: "Choose a client to open this conversation.",
      });
      return;
    }
    startTransition(async () => {
      try {
        for (let index = 0; index < thread.unreadIds.length; index += 1000) {
          const ids = thread.unreadIds.slice(index, index + 1000);
          const result = await markMessagesRead({ clientId, ids });
          if (!result.ok) {
            setError({ threadId: thread.id, text: result.error });
            return;
          }
          confirmRead(ids);
        }
      } catch {
        setError({
          threadId: thread.id,
          text: "Could not mark this conversation as read. Please try again.",
        });
      }
    });
  }

  function backToList() {
    setSelected(null);
    requestAnimationFrame(() => {
      const previous = selected ? threadButtons.current.get(selected) : null;
      (previous ?? searchRef.current)?.focus();
    });
  }

  function clearFilters() {
    setSearch("");
    setCampaign("");
    setInterest("");
    setUnread(false);
  }

  return (
    <section className="inbox-workspace" aria-label="Reply inbox">
      {data.truncated && (
        <p className="inbox-notice">
          Showing the most recent available messages. Older conversations may
          not appear in these results.
        </p>
      )}
      {selected && !active && (
        <p className="inbox-notice" role="status">
          This conversation is no longer available. Select another conversation.
        </p>
      )}
      <div className="inbox-layout" data-thread-open={active ? "true" : "false"}>
        <aside className="inbox-status-rail" aria-label="Conversation filters">
          <button
            type="button"
            className="inbox-filter-toggle"
            aria-expanded={filtersOpen}
            aria-controls={filterId}
            onClick={() => setFiltersOpen((value) => !value)}
          >
            <SlidersHorizontal size={16} aria-hidden="true" />
            <span>{unread ? `Unread · ${statusLabel}` : statusLabel}</span>
            <ChevronDown size={16} aria-hidden="true" />
          </button>
          <div id={filterId} className="inbox-status-options" data-open={filtersOpen}>
            <p className="inbox-rail-label">Mailbox</p>
            <button
              type="button"
              className="inbox-status-option"
              aria-pressed={!interest && !unread}
              onClick={() => { setInterest(""); setUnread(false); }}
            >
              <InboxIcon size={16} aria-hidden="true" /> All replies
              <span className="inbox-count">{allThreads.length}</span>
            </button>
            <button
              type="button"
              className="inbox-status-option"
              aria-pressed={unread}
              onClick={() => setUnread((value) => !value)}
            >
              <Mail size={16} aria-hidden="true" /> Unread
              {unreadCount > 0 && <span className="inbox-count">{unreadCount}</span>}
            </button>
            <p className="inbox-rail-label inbox-status-label">Reply status</p>
            <button
              type="button"
              className="inbox-status-option"
              aria-pressed={interest === "1"}
              onClick={() => setInterest("1")}
            >
              <ThumbsUp size={16} aria-hidden="true" /> Interested
            </button>
            <button
              type="button"
              className="inbox-status-option"
              aria-pressed={interest === "2"}
              onClick={() => setInterest("2")}
            >
              <CalendarDays size={16} aria-hidden="true" /> Meeting booked
            </button>
            <details className="inbox-other-statuses">
              <summary>
                <span>Other statuses</span>
                <ChevronDown size={14} aria-hidden="true" />
              </summary>
              {otherStatuses.map(([value, label]) => (
                <button
                  type="button"
                  key={value}
                  className="inbox-status-option"
                  aria-pressed={interest === value}
                  onClick={() => setInterest(value)}
                >
                  {label}
                </button>
              ))}
              <button
                type="button"
                className="inbox-status-option"
                aria-pressed={interest === "unclassified"}
                onClick={() => setInterest("unclassified")}
              >
                Not classified
              </button>
            </details>
            {interest && (
              <button
                type="button"
                className="inbox-clear-status"
                onClick={() => setInterest("")}
              >
                Clear reply status
              </button>
            )}
          </div>
        </aside>
        <section className="inbox-conversations" aria-label="Conversations">
          <div className="inbox-list-toolbar">
            <div className="inbox-list-title">
              <h2>Conversations</h2>
              <span className="inbox-list-total" aria-label={`${allThreads.length} total conversations`}>{allThreads.length}</span>
            </div>
            <label className="inbox-search">
              <Search size={17} aria-hidden="true" />
              <input
                ref={searchRef}
                aria-label="Search conversations by name or email"
                placeholder="Search name or email"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
            <select
              className="inbox-campaign-filter"
              aria-label="Filter by campaign"
              value={campaign}
              onChange={(event) => setCampaign(event.target.value)}
            >
              <option value="">All campaigns</option>
              {data.campaigns.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
            <div className="inbox-list-summary">
              <span role="status">
                {filtered.length} {filtered.length === 1 ? "conversation" : "conversations"}
              </span>
              {hasFilters && (
                <button type="button" onClick={clearFilters}>Clear filters</button>
              )}
            </div>
          </div>
          <div className="inbox-thread-scroll">
            {filtered.length ? (
              <ul className="inbox-thread-items">
                {filtered.map((thread) => (
                  <li key={thread.id}>
                    <button
                      type="button"
                      ref={(node) => {
                        if (node) threadButtons.current.set(thread.id, node);
                        else threadButtons.current.delete(thread.id);
                      }}
                      className="thread-row"
                      data-unread={thread.unread}
                      onClick={() => openThread(thread)}
                      aria-current={active?.id === thread.id ? "true" : undefined}
                    >
                      <ContactAvatar name={thread.leadName} address={thread.leadEmail} channel="email" />
                      <span className="thread-row-content">
                        <span className="thread-row-topline">
                          <strong>{thread.leadName || "Contact"}</strong>
                          <time dateTime={validTime(thread.latest.sent_at) ? thread.latest.sent_at : undefined}>
                            {shortDate(thread.latest.sent_at)}
                          </time>
                        </span>
                        {thread.leadEmail && thread.leadEmail !== thread.leadName && <span className="thread-row-address">{thread.leadEmail}</span>}
                        <span className="thread-row-subject">
                          {thread.unread && <span className="thread-unread-dot" role="img" aria-label="Unread" />}
                          <span>{thread.latest.subject || "No subject"}</span>
                        </span>
                        <span className="thread-row-preview">
                          {thread.latest.body_text || "No plain-text content available."}
                        </span>
                        <span className="conversation-row-meta"><ConversationChannel channel="email" />{thread.interest !== null && <span className="conversation-outcome" data-positive={[1, 2, 4].includes(thread.interest)}>{interestLabel(thread.interest)}</span>}</span>
                        <span className="thread-row-campaign">{campaignName(thread.campaignId)}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="inbox-empty inbox-empty-list">
                <span className="inbox-empty-icon"><InboxIcon size={24} aria-hidden="true" /></span>
                <h3>{data.messages.length ? "No matching conversations" : "Your inbox is ready"}</h3>
                <p>{data.messages.length ? "Try another name, email, or filter." : "Replies will appear here as your campaigns get going."}</p>
                {hasFilters && <button type="button" className="inbox-text-button" onClick={clearFilters}>Clear filters</button>}
              </div>
            )}
          </div>
        </section>
        <section
          className="inbox-reading-pane"
          aria-label={active ? `Conversation with ${active.leadName || "contact"}` : "Conversation detail"}
        >
          {active ? (
            <>
              <header className="thread-heading">
                <button type="button" className="thread-back" onClick={backToList}>
                  <ArrowLeft size={17} aria-hidden="true" /> All conversations
                </button>
                <div className="thread-heading-topline">
                  <div className="thread-heading-context"><ConversationChannel channel="email" /><span className="thread-campaign-name">{campaignName(active.campaignId)}</span></div>
                  <span className="thread-status-badge" data-positive={active.interest !== null && [1, 2, 4].includes(active.interest)}>
                    {interestLabel(active.interest)}
                  </span>
                </div>
                <h2 ref={headingRef} tabIndex={-1}>{active.latest.subject || "No subject"}</h2>
                <div className="thread-contact">
                  <ContactAvatar name={active.leadName} address={active.leadEmail} channel="email" size="large" />
                  <div>
                    <strong>{active.leadName || "Contact"}</strong>
                    {active.leadName !== active.leadEmail && active.leadEmail && <span>{active.leadEmail}</span>}
                  </div>
                </div>
                <div className="thread-history-meta">
                  <span>{active.messages.length} {active.messages.length === 1 ? "message" : "messages"} · Times in UTC</span>
                  {pending ? (
                    <span role="status">Updating read status…</span>
                  ) : !active.unread ? (
                    <span><CheckCheck size={14} aria-hidden="true" /> Read in this workspace</span>
                  ) : null}
                </div>
                {error?.threadId === active.id && (
                  <div className="inbox-read-error" role="alert">
                    <p>{error.text}</p>
                    <button type="button" disabled={pending} onClick={() => openThread(active)}>Retry</button>
                  </div>
                )}
              </header>
              <div className="message-history">
                {active.messages.map((message) => (
                  <ConversationMessageCard key={message.id} sender={message.from_email} senderName={message.direction === "received" && message.from_email.toLowerCase() === active.leadEmail.toLowerCase() ? active.leadName : undefined} recipient={message.to_email} direction={message.direction === "sent" || message.direction === "received" ? message.direction : "unknown"} sentAt={message.sent_at} body={message.body_text} automatic={Boolean(message.is_auto_reply)} />
                ))}
                <p className="inbox-read-only"><LockKeyhole size={14} aria-hidden="true" />This inbox is read-only.</p>
              </div>
            </>
          ) : (
            <div className="inbox-empty inbox-empty-detail">
              <span className="inbox-empty-icon"><Mail size={30} strokeWidth={1.5} aria-hidden="true" /></span>
              <h2>Select a conversation</h2>
              <p>Your campaign conversations, all in one place. Choose a reply to read its history.</p>
            </div>
          )}
        </section>
      </div>
    </section>
  );
}
