import test from "node:test";
import assert from "node:assert/strict";
import { createInboxRefresher, INBOX_REFRESH_MS, mergeRefreshedConversations, pauseInboxRefresh } from "../src/lib/inbox-refresh";
import { beginReply, editReplyDraft, emptyReplyDraft, settleReply } from "../src/lib/reply-draft";
import type { ConversationDetail, ConversationPage, ConversationSummary } from "../src/lib/conversations";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ReplyComposer } from "../src/components/reply-composer";

const conversation: ConversationSummary = {
  id: "conversation-a", clientId: "workspace-a", channel: "email", campaignId: null, campaignName: "",
  subject: "Introduction", contactName: "Taylor", contactAddress: "taylor@example.test", senderLabel: "Team",
  owner: { kind: "covora", userId: null, name: "Covora" }, ownedByMe: false, version: 1,
  latestMessageId: "message-a", latestAt: "2026-10-05T12:00:00Z", preview: "Hello", unread: true,
  status: "needs_reply", interest: null, canReply: true, canTakeover: true, replyUnavailableReason: null,
};
const page: ConversationPage = { conversations: [conversation], nextCursor: null };
const detail: ConversationDetail = { ...conversation, messages: [], commands: [], messagesTruncated: false };
const snapshot = () => ({ channel: "all" as const, selected: conversation.id as string | null, selectedVersion: 1, selectionRequest: 0, listRequest: 0, paused: false });
const unexpectedDetailFailure = () => assert.fail("valid detail was rejected");

test("automatic refresh pauses for hidden tabs, composition, pending sends and unresolved attempts", () => {
  assert.equal(INBOX_REFRESH_MS, 60_000);
  assert.equal(pauseInboxRefresh(true, false, false), false);
  for (const [visible, pending, editing] of [[false, false, false], [true, true, false], [true, false, true]]) assert.equal(pauseInboxRefresh(visible, pending, editing), true);
  for (const text of ["Draft", " "]) assert.equal(pauseInboxRefresh(true, false, false, editReplyDraft(emptyReplyDraft(), text)), true);
  const unknown = settleReply(beginReply(editReplyDraft(emptyReplyDraft(), "Original"), "command-a")!, "command-a", "unknown");
  assert.equal(pauseInboxRefresh(true, false, false, editReplyDraft(unknown, "")), true);
  assert.equal(pauseInboxRefresh(true, false, false, emptyReplyDraft()), false);
});

test("fresh list includes arrivals without duplicating loaded history or skipping a pagination gap", () => {
  const older = { ...conversation, id: "older" }, fresh = { ...conversation, version: 2 }, arrival = { ...conversation, id: "new" };
  const merged = mergeRefreshedConversations({ conversations: [conversation, older], nextCursor: "old-cursor" }, { conversations: [arrival, fresh], nextCursor: "fresh-cursor" });
  assert.deepEqual(merged.conversations.map(item => [item.id, item.version]), [["new", 1], [conversation.id, 2], ["older", 1]]);
  assert.equal(merged.nextCursor, "fresh-cursor");
  assert.deepEqual(mergeRefreshedConversations(merged, page), page);
});

test("refresh reads the current channel and selection once; overlapping focus/timer events share one read", async () => {
  let finish!: (value: { data: ConversationPage }) => void, lists = 0, details = 0, applies = 0;
  const current = snapshot();
  const refresher = createInboxRefresher({ snapshot: () => current,
    list: async channel => { assert.equal(channel, "all"); lists++; return await new Promise(resolve => { finish = resolve; }); },
    detail: async id => { assert.equal(id, conversation.id); details++; return { data: detail }; },
    applyPage: fresh => { applies++; assert.equal(fresh, page); }, applyDetail: selected => assert.equal(selected.unread, true), detailFailed: unexpectedDetailFailure,
    failed: () => assert.fail("valid refresh failed"),
  });
  const first = refresher.refresh();
  await refresher.refresh();
  finish({ data: page }); await first;
  assert.deepEqual([lists, details, applies], [1, 1, 1]);
});

test("typing, selection changes, explicit actions and channel loads invalidate an in-flight refresh", async () => {
  for (const change of [
    (state: ReturnType<typeof snapshot>) => { state.paused = true; },
    (state: ReturnType<typeof snapshot>) => { state.selected = "other"; },
    (state: ReturnType<typeof snapshot>) => { state.selectionRequest++; },
    (state: ReturnType<typeof snapshot>) => { state.listRequest++; },
  ]) {
    const current = snapshot();
    let finish!: (value: { data: ConversationPage }) => void;
    const refresher = createInboxRefresher({ snapshot: () => ({ ...current }),
      list: async () => await new Promise(resolve => { finish = resolve; }), detail: async () => ({ data: detail }),
      applyPage: () => assert.fail("stale response replaced current context"), applyDetail: () => assert.fail("stale detail replaced current context"), detailFailed: unexpectedDetailFailure, failed: () => assert.fail("stale failure surfaced"),
    });
    const running = refresher.refresh(); change(current); finish({ data: page }); await running;
  }
});

test("failed background reads retain current data, release the lock and permit a later recovery", async () => {
  let attempts = 0, failures = 0, applied = 0;
  const refresher = createInboxRefresher({ snapshot, list: async () => { attempts++; return attempts === 1 ? { error: "Unavailable" } : { data: page }; },
    detail: async () => ({ data: detail }), applyPage: () => { applied++; }, applyDetail: () => {}, detailFailed: unexpectedDetailFailure, failed: () => { failures++; },
  });
  await refresher.refresh(); await refresher.refresh();
  assert.deepEqual([attempts, failures, applied], [2, 1, 1]);
});

test("paused or disposed refreshes make no requests and unmount drops pending responses", async () => {
  let finish!: (value: { data: ConversationPage }) => void, calls = 0;
  const current = snapshot(); current.paused = true;
  const refresher = createInboxRefresher({ snapshot: () => ({ ...current }),
    list: async () => { calls++; return await new Promise(resolve => { finish = resolve; }); }, detail: async () => ({ data: detail }),
    applyPage: () => assert.fail("unmounted refresh applied"), applyDetail: () => assert.fail("unmounted detail applied"), detailFailed: unexpectedDetailFailure, failed: () => assert.fail("unmounted error surfaced"),
  });
  await refresher.refresh(); assert.equal(calls, 0);
  current.paused = false;
  const pending = refresher.refresh(); refresher.dispose(); finish({ data: page }); await pending; await refresher.refresh();
  assert.equal(calls, 1);
});

test("a newer list cannot be overwritten by stale detail or clear the required refresh", async () => {
  const latest = { ...conversation, version: 2, latestMessageId: "message-b", owner: { kind: "user" as const, userId: "teammate", name: "Teammate" } };
  let currentPage = page, currentDetail = detail, refreshRequired = true;
  const refresher = createInboxRefresher({ snapshot,
    list: async () => ({ data: { conversations: [latest], nextCursor: null } }), detail: async () => ({ data: detail }),
    applyPage: fresh => { currentPage = fresh; }, applyDetail: fresh => { currentDetail = fresh; refreshRequired = false; },
    detailFailed: id => { assert.equal(id, conversation.id); refreshRequired = true; }, failed: () => assert.fail("list refresh failed"),
  });
  await refresher.refresh();
  assert.equal(currentPage.conversations[0], latest);
  assert.equal(currentPage.conversations[0].owner.name, "Teammate");
  assert.equal(currentDetail, detail);
  assert.equal(refreshRequired, true);
});

test("known newer detail stays authoritative, while a matching fresh detail clears the blocked state", async () => {
  let currentDetail = { ...detail, version: 3, latestMessageId: "message-c" }, refreshRequired = true, generation = 2;
  const refresher = createInboxRefresher({ snapshot: () => ({ ...snapshot(), selectedVersion: currentDetail.version }),
    list: async () => ({ data: page }), detail: async () => ({ data: { ...detail, version: generation, latestMessageId: generation === 3 ? "message-c" : "message-b" } }),
    applyPage: () => {}, applyDetail: fresh => { currentDetail = fresh as typeof currentDetail; refreshRequired = false; },
    detailFailed: () => { refreshRequired = true; }, failed: () => assert.fail("list refresh failed"),
  });
  await refresher.refresh(); assert.equal(currentDetail.version, 3); assert.equal(refreshRequired, true);
  generation = 3; await refresher.refresh(); assert.equal(currentDetail.latestMessageId, "message-c"); assert.equal(refreshRequired, false);
});

test("withdrawn or failed selected detail does not freeze new list arrivals, and replying stays blocked", async () => {
  for (const throws of [false, true]) {
    const arrival = { ...conversation, id: "arrival" };
    const drafts = { other: editReplyDraft(emptyReplyDraft(), "Keep this draft") };
    let currentPage = page, currentDetail = detail, refreshRequired = false, detailError = "";
    const current = snapshot();
    const refresher = createInboxRefresher({ snapshot: () => current,
      list: async () => ({ data: { conversations: [arrival], nextCursor: null } }),
      detail: async () => { if (throws) throw new Error("Unavailable"); return { error: "Access changed" }; },
      applyPage: fresh => { currentPage = fresh; }, applyDetail: fresh => { currentDetail = fresh; refreshRequired = false; },
      detailFailed: id => { assert.equal(id, current.selected); refreshRequired = true; detailError = "Refresh this conversation before replying."; },
      failed: () => assert.fail("detail failure incorrectly marked the fresh list unavailable"),
    });
    await refresher.refresh();
    assert.deepEqual(currentPage.conversations.map(item => item.id), ["arrival"]);
    assert.equal(currentDetail, detail); assert.equal(current.selected, conversation.id); assert.equal(drafts.other.text, "Keep this draft");
    const html = renderToStaticMarkup(createElement(ReplyComposer, { conversation: currentDetail, draft: editReplyDraft(emptyReplyDraft(), "A later draft"), pending: false,
      refreshRequired, error: detailError, demo: false, canWrite: true, onChange: () => {}, onSend: () => {}, onRefresh: () => {},
    }));
    assert.match(html, /Refresh this conversation before replying/);
    assert.match(html, /class="reply-send" disabled=""/);
    assert.match(html, /A later draft/);
  }
});
