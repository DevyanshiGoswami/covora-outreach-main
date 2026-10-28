export type ReplyOutcome = "pending" | "sent" | "failed" | "unknown";
export type ReplyAttempt = { commandId: string; bodyText: string; outcome: ReplyOutcome };
export type ReplyDraft = { text: string; attempt: ReplyAttempt | null };
export const emptyReplyDraft = (): ReplyDraft => ({ text: "", attempt: null });

/** An unresolved command must be checked before any new send is offered. */
export function replyIsUnresolved(draft: ReplyDraft): boolean {
  return draft.attempt?.outcome === "pending" || draft.attempt?.outcome === "unknown";
}
export function editReplyDraft(draft: ReplyDraft, text: string): ReplyDraft {
  return { ...draft, text };
}
export function beginReply(draft: ReplyDraft, commandId: string): ReplyDraft | null {
  if (replyIsUnresolved(draft) || !draft.text.trim()) return null;
  return { ...draft, attempt: { commandId, bodyText: draft.text.trim(), outcome: "pending" } };
}
export function settleReply(draft: ReplyDraft, commandId: string, outcome: ReplyOutcome): ReplyDraft {
  if (!draft.attempt || draft.attempt.commandId !== commandId) return draft;
  const text = outcome === "sent" && draft.attempt.outcome !== "sent" && draft.text.trim() === draft.attempt.bodyText ? "" : draft.text;
  return { text, attempt: { ...draft.attempt, outcome } };
}
