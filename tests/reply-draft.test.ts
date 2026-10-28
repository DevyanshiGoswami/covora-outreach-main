import test from "node:test";
import assert from "node:assert/strict";
import { beginReply, editReplyDraft, emptyReplyDraft, replyIsUnresolved, settleReply } from "../src/lib/reply-draft";

test("unknown outcome retains the exact command and submitted text and blocks a new send", () => {
  const entered = editReplyDraft(emptyReplyDraft(), "  Thanks — Tuesday works.  ");
  const sending = beginReply(entered, "first-command")!;
  const unknown = settleReply(sending, "first-command", "unknown");
  const edited = editReplyDraft(unknown, "An updated draft for later");
  assert.equal(edited.text, "An updated draft for later");
  assert.deepEqual(edited.attempt, { commandId: "first-command", bodyText: "Thanks — Tuesday works.", outcome: "unknown" });
  assert.equal(replyIsUnresolved(edited), true);
  assert.equal(beginReply(edited, "replacement-command"), null);
});

test("a confirmed send clears only its own draft and cannot erase newer edits", () => {
  const sending = beginReply(editReplyDraft(emptyReplyDraft(), "Original reply"), "first-command")!;
  assert.equal(settleReply(sending, "first-command", "sent").text, "");
  const newer = editReplyDraft(sending, "Another thought for a follow-up");
  assert.equal(settleReply(newer, "first-command", "sent").text, "Another thought for a follow-up");
  assert.equal(settleReply(newer, "stale-command", "sent"), newer);
  const accepted = settleReply(sending, "first-command", "sent");
  const repeatedText = editReplyDraft(accepted, "Original reply");
  assert.equal(settleReply(repeatedText, "first-command", "sent").text, "Original reply");
});

test("definitive failure preserves the draft and permits a fresh explicit attempt", () => {
  const sending = beginReply(editReplyDraft(emptyReplyDraft(), "Can we meet Wednesday?"), "first-command")!;
  assert.equal(beginReply(sending, "duplicate-command"), null);
  const failed = settleReply(sending, "first-command", "failed");
  assert.equal(failed.text, "Can we meet Wednesday?");
  assert.equal(replyIsUnresolved(failed), false);
  assert.equal(beginReply(failed, "next-command")?.attempt?.commandId, "next-command");
  assert.equal(beginReply(editReplyDraft(emptyReplyDraft(), "  \n  "), "empty-command"), null);
});
