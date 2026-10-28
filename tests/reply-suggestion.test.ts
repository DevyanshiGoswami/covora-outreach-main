import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { suggestFollowUp, suggestReply, unfilledPlaceholders } from "../src/lib/reply-suggestion";
import { ReplyComposer } from "../src/components/reply-composer";
import type { ConversationDetail, ConversationMessage } from "../src/lib/conversations";

const message = (id: number, direction: ConversationMessage["direction"], bodyText: string, day: number): ConversationMessage =>
  ({ id: `00000000-0000-4000-8000-00000000000${id}`, direction, bodyText, sentAt: `2026-10-${String(day).padStart(2, "0")}T12:00:00Z`, senderLabel: "x@example.test" });

test("drafts answer the prospect's latest request and leave unknown facts as placeholders", () => {
  const pricing = suggestReply([message(1, "sent", "Open to a look?", 14), message(2, "received", "Interested. Can you send pricing?", 22)], "Sarah Lindgren")!;
  assert.match(pricing, /^Hi Sarah,\n\n/);
  assert.deepEqual(unfilledPlaceholders(pricing), ["[pricing details]", "[booking link]"]);
  assert.match(suggestReply([message(1, "received", "Not interested, thanks.", 2)], "Tom")!, /won't follow up further/);
  assert.equal(unfilledPlaceholders(suggestReply([message(1, "received", "Not interested.", 2)], "Tom")!).length, 0);
  assert.match(suggestReply([message(1, "received", "Sounds good.", 2)], "jo@example.test")!, /^Hi,\n\n/);
});

test("no draft when the team spoke last, for away replies, or for an empty thread", () => {
  assert.equal(suggestReply([message(1, "received", "Call Thursday?", 2), message(2, "sent", "Thursday works", 3)], "Priya"), null);
  assert.equal(suggestReply([message(1, "received", "I am out of office until Monday.", 2)], "Priya"), null);
  assert.equal(suggestReply([], "Priya"), null);
});

test("follow-ups ease off with each unanswered message and skip honorifics in the greeting", () => {
  const first = suggestFollowUp([message(1, "sent", "Intro", 14)], "Dr. Ben Likely")!;
  assert.equal(first.number, 1);
  assert.match(first.text, /^Hi Ben,\n\nI wanted to follow up on my last note/);
  assert.equal(suggestFollowUp([message(1, "sent", "Intro", 14), message(2, "sent", "Bump", 18)], "Anna")!.number, 2);
  assert.match(suggestFollowUp([message(1, "sent", "a", 1), message(2, "sent", "b", 2), message(3, "sent", "c", 3)], "Anna")!.text, /last note for now/);
  assert.match(suggestFollowUp([message(1, "received", "Interested", 1), message(2, "sent", "Here you go", 2)], "Anna")!.text, /Did you get a chance/);
  assert.equal(suggestFollowUp([message(1, "sent", "a", 1), message(2, "received", "b", 2)], "Anna"), null);
  assert.equal(unfilledPlaceholders(first.text).length, 0);
});

test("composer labels a Covora draft and blocks Send until placeholders are filled", () => {
  const conversation = { id: "10000000-0000-4000-8000-000000000001", clientId: "00000000-0000-4000-8000-000000000001", channel: "email", campaignId: null, campaignName: "", subject: "Hi", contactName: "Sarah", contactAddress: "s@example.test", senderLabel: "team@example.test", owner: { kind: "covora", userId: null, name: "Covora" }, ownedByMe: false, version: 1, latestMessageId: "20000000-0000-4000-8000-000000000001", latestAt: "2026-10-22T12:00:00Z", preview: "", unread: false, status: "needs_reply", canReply: true, canTakeover: true, replyUnavailableReason: null, interest: null, messages: [], commands: [], messagesTruncated: false } satisfies ConversationDetail;
  const render = (text: string) => renderToStaticMarkup(createElement(ReplyComposer, { conversation, draft: { text, attempt: null }, pending: false, refreshRequired: false, demo: false, canWrite: true, draftSource: "auto", onChange: () => {}, onSend: () => {}, onRefresh: () => {}, onDiscard: () => {}, onRegenerate: () => {} }));
  const blocked = render("Hi Sarah, [pricing details]");
  assert.match(blocked, /Drafted by Covora/);
  assert.match(blocked, /Fill in \[pricing details\] before sending/);
  assert.match(blocked, /class="reply-send" disabled=""/);
  assert.match(blocked, /Discard draft/);
  assert.doesNotMatch(render("Hi Sarah, it is $500."), /class="reply-send" disabled=""/);
});
