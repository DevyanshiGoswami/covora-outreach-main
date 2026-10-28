import test from "node:test";
import assert from "node:assert/strict";
import { newMessageText, replyTag, summarizeConversation } from "../src/lib/conversation-summary";
import type { ConversationMessage } from "../src/lib/conversations";

const message = (id: number, direction: ConversationMessage["direction"], bodyText: string, day: number): ConversationMessage =>
  ({ id: `m${id}`, direction, bodyText, sentAt: `2026-10-${String(day).padStart(2, "0")}T12:00:00Z`, senderLabel: direction === "sent" ? "team@example.test" : "sarah@example.test" });

test("summary drops quoted history and sign-offs before summarizing", () => {
  assert.equal(newMessageText("Sounds good.\n\nBest,\nSarah\nClinic Director\n\nOn Oct 14, team wrote:\n> Hi Sarah"), "Sounds good.");
  assert.equal(newMessageText("> quoted only\nNew line here"), "New line here");
});

test("summary reads as one sentence with the prospect's question and a next step", () => {
  const result = summarizeConversation([
    message(1, "sent", "Hi Sarah, open to a quick look?", 14),
    message(2, "received", "Interested. Tell me more. Can you send pricing for what you would do for our clinic?\n\nOn Oct 14 team wrote:\n> Hi Sarah", 22),
  ], "Sarah Lindgren");
  assert.equal(result.headline, "Sarah replied on Oct 22 and asked for pricing and wants to hear more.");
  assert.equal(result.quoteLabel, "They asked");
  assert.deepEqual(result.quotes, ["Can you send pricing for what you would do for our clinic?"]);
  assert.equal(result.nextStep, "send pricing and offer a short call.");
});

test("summary waits when the team replied last, but keeps a decline visible", () => {
  const waiting = summarizeConversation([message(1, "received", "Can we talk Thursday?", 20), message(2, "sent", "Thursday works.", 21)], "Priya Rao");
  assert.match(waiting.headline, /Your team has replied since\./);
  assert.equal(waiting.nextStep, "wait for their reply.");
  const declined = summarizeConversation([message(1, "received", "Not interested, please remove me.", 20)], "Tom");
  assert.match(declined.headline, /is not interested/);
  assert.equal(declined.quoteLabel, "They wrote");
  assert.equal(declined.nextStep, "no reply is needed unless you want to close politely.");
});

test("summary is honest when there is nothing from the prospect", () => {
  assert.equal(summarizeConversation([], "Ben").quotes.length, 0);
  const outbound = summarizeConversation([message(1, "sent", "Hello", 1)], "Ben Likely");
  assert.match(outbound.headline, /Ben has not replied yet/);
  assert.equal(summarizeConversation([message(1, "received", "", 2)], "Ben").nextStep, null);
});

test("reply tags combine the recorded outcome with the prospect's request", () => {
  assert.deepEqual(replyTag("Interested", "Can you send pricing?"), { label: "Interested: asked for pricing", tone: "positive" });
  assert.deepEqual(replyTag("Interested", null), { label: "Interested", tone: "positive" });
  assert.deepEqual(replyTag("Not interested", "No thanks."), { label: "Not interested: declined", tone: "neutral" });
  assert.deepEqual(replyTag(null, "Do you work outside the US?"), { label: "Asked a question", tone: "question" });
  assert.deepEqual(replyTag(null, "Can you do a call Thursday?"), { label: "Wants a call", tone: "positive" });
  assert.equal(replyTag(null, "Thanks"), null);
});
