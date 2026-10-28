import { test } from "node:test";
import assert from "node:assert/strict";
import {
  completeReadSelection,
  filterInboxThreads,
  inboxThreads,
  validReadSelection,
} from "../src/lib/inbox";
import type { Lead, Message } from "../src/lib/model";

const clientId = "10000000-0000-4000-8000-000000000001";
const one = "20000000-0000-4000-8000-000000000001";
const two = "20000000-0000-4000-8000-000000000002";
const base: Message = {
  id: one,
  campaign_id: "campaign-a",
  thread_key: "thread-a",
  direction: "received",
  lead_email: "dana@example.test",
  from_email: "dana@example.test",
  to_email: "team@example.test",
  subject: "Hello",
  body_text: "Interested",
  sent_at: "2026-10-02T12:00:00Z",
  interest: 1,
  is_auto_reply: false,
  client_read_at: null,
};
const lead: Lead = {
  id: "lead-a",
  campaign_id: "campaign-a",
  email: "dana@example.test",
  first_name: "Dana",
  last_name: "Lee",
  company: "Example",
  status: "replied",
  last_step: null,
  reply_count: 1,
  interest: 1,
  last_activity_at: null,
};

test("thread grouping is campaign-safe, chronological, and does not mutate inputs", () => {
  const messages = [
    base,
    { ...base, id: two, direction: "sent", sent_at: "2026-10-01T12:00:00Z" },
    { ...base, id: "other", campaign_id: "campaign-b" },
  ];
  const groups = inboxThreads(messages, [lead]);
  assert.equal(groups.length, 2);
  const group = groups.find((thread) => thread.campaignId === "campaign-a")!;
  assert.deepEqual(
    group.messages.map((message) => message.id),
    [two, one],
  );
  assert.deepEqual(group.unreadIds, [one]);
  assert.equal(group.leadName, "Dana Lee");
  assert.equal(messages[0].id, one);
});

test("search finds lead names and email while combining campaign, interest and unread filters", () => {
  const groups = inboxThreads([base], [lead]);
  const filters = {
    campaign: "campaign-a",
    interest: "1",
    unread: true,
    search: "lee",
  };
  assert.equal(filterInboxThreads(groups, filters).length, 1);
  assert.equal(
    filterInboxThreads(groups, { ...filters, search: "DANA@EXAMPLE" }).length,
    1,
  );
  assert.equal(
    filterInboxThreads(groups, { ...filters, interest: "-1" }).length,
    0,
  );
  assert.equal(
    filterInboxThreads(groups, { ...filters, campaign: "campaign-b" }).length,
    0,
  );
});

test("unread state changes only with acknowledged received ids; sent messages are never unread", () => {
  assert.equal(inboxThreads([base], [lead])[0].unread, true);
  assert.equal(inboxThreads([base], [lead], new Set([one]))[0].unread, false);
  assert.equal(
    inboxThreads([{ ...base, direction: "sent" }], [lead])[0].unread,
    false,
  );
});

test("read request rejects malformed, empty and oversized selections and deduplicates valid ids", () => {
  assert.deepEqual(validReadSelection({ clientId, ids: [one, one, two] }), {
    clientId,
    ids: [one, two],
  });
  for (const value of [
    null,
    {},
    { clientId, ids: [] },
    { clientId, ids: ["other"] },
    { clientId: "other", ids: [one] },
    { clientId, ids: Array(1001).fill(one) },
  ]) {
    assert.equal(validReadSelection(value), null);
  }
});

test("read request denies mixed tenant, missing and outgoing ids excluded by scoped query", () => {
  assert.equal(completeReadSelection([one, two], [{ id: one }]), false);
  assert.equal(completeReadSelection([one], [{ id: null }]), false);
  assert.equal(
    completeReadSelection([one, two], [{ id: two }, { id: one }]),
    true,
  );
});
