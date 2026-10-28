import type { Workspace } from "./access";
import { clientCampaignName, clientReplyReason } from "./client-copy";
export type ConversationChannel = "email" | "linkedin";
export type ConversationFilter = ConversationChannel | "all";
export type ReplyStatus = "pending" | "sending" | "sent" | "failed" | "unknown";
export type ConversationOwner = { kind: "covora" | "user"; userId: string | null; name: string };
export type ConversationSummary = {
  id: string; clientId: string; channel: ConversationChannel; campaignId: string | null; campaignName: string;
  subject: string; contactName: string; contactAddress: string; senderLabel: string; owner: ConversationOwner;
  ownedByMe: boolean; version: number; latestMessageId: string | null; latestAt: string; preview: string;
  unread: boolean; status: "needs_reply" | "waiting" | "done"; canReply: boolean; canTakeover: boolean; replyUnavailableReason: string | null; interest?: string | null;
};
export type ConversationMessage = { id: string; direction: "sent" | "received"; bodyText: string; sentAt: string; senderLabel: string };
export type ReplyCommand = { id: string; conversationId: string; bodyText: string; status: ReplyStatus; createdAt: string; updatedAt: string; actorName: string };
export type ConversationDetail = ConversationSummary & { messages: ConversationMessage[]; commands: ReplyCommand[]; messagesTruncated: boolean };
export type ConversationPage = { conversations: ConversationSummary[]; nextCursor: string | null };
export type ReplyInput = { clientId: string; commandId: string; expectedVersion: number; latestMessageId: string; bodyText: string; takeover: boolean };
export type OwnerInput = { clientId: string; expectedVersion: number; owner: "me" | "covora" };
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const record = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Conversation data could not be verified.");
  return value as Record<string, unknown>;
};
const string = (value: unknown): string => { if (typeof value !== "string") throw new Error("Conversation data could not be verified."); return value; };
const bool = (value: unknown): boolean => { if (typeof value !== "boolean") throw new Error("Conversation data could not be verified."); return value; };
const id = (value: unknown): string => { const text = string(value); if (!UUID.test(text)) throw new Error("Conversation data could not be verified."); return text; };
const nullableId = (value: unknown) => value === null ? null : id(value);
const date = (value: unknown): string => { const text = string(value); if (!/^\d{4}-\d{2}-\d{2}T/.test(text) || !Number.isFinite(Date.parse(text))) throw new Error("Conversation data could not be verified."); return text; };
const version = (value: unknown): number => { if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1) throw new Error("Conversation data could not be verified."); return value; };
function member<T extends string>(value: unknown, values: readonly T[]): T { if (typeof value !== "string" || !values.includes(value as T)) throw new Error("Conversation data could not be verified."); return value as T; }
function array(value: unknown): unknown[] { if (!Array.isArray(value)) throw new Error("Conversation data could not be verified."); return value; }
function unique<T extends { id: string }>(values: T[]): T[] { if (new Set(values.map(v => v.id)).size !== values.length) throw new Error("Conversation data could not be verified."); return values; }
export function conversationSummary(value: unknown, clientId: string): ConversationSummary {
  const v = record(value), o = record(v.owner);
  if (id(v.clientId) !== clientId) throw new Error("Conversation data could not be verified.");
  const owner = { kind: member(o.kind, ["covora", "user"]), userId: nullableId(o.userId), name: string(o.name) };
  if ((owner.kind === "covora") !== (owner.userId === null)) throw new Error("Conversation data could not be verified.");
  return { id: id(v.id), clientId, interest: v.interest == null ? null : string(v.interest), channel: member(v.channel, ["email", "linkedin"]), campaignId: nullableId(v.campaignId), campaignName: string(v.campaignName) ? clientCampaignName(string(v.campaignName)) : "", subject: string(v.subject), contactName: string(v.contactName), contactAddress: string(v.contactAddress), senderLabel: string(v.senderLabel), owner, ownedByMe: bool(v.ownedByMe), version: version(v.version), latestMessageId: nullableId(v.latestMessageId), latestAt: date(v.latestAt), preview: string(v.preview), unread: bool(v.unread), status: member(v.status, ["needs_reply", "waiting", "done"]), canReply: bool(v.canReply), canTakeover: bool(v.canTakeover), replyUnavailableReason: clientReplyReason(v.replyUnavailableReason === null ? null : string(v.replyUnavailableReason)) };
}
export function conversationsFromResponse(value: unknown, clientId: string, channel: ConversationFilter): ConversationPage {
  const v = record(value);
  const conversations = unique(array(v.conversations).map(item => conversationSummary(item, clientId)));
  if (conversations.length > 50 || conversations.some(item => channel !== "all" && item.channel !== channel)) throw new Error("Conversation data could not be verified.");
  const nextCursor = v.nextCursor === null ? null : string(v.nextCursor);
  if (nextCursor !== null && (!nextCursor || nextCursor.length > 1024)) throw new Error("Conversation data could not be verified.");
  return { conversations, nextCursor };
}
export function commandFromResponse(value: unknown, conversationId: string): ReplyCommand {
  const v = record(value);
  if (id(v.conversationId) !== conversationId) throw new Error("Conversation data could not be verified.");
  return { id: id(v.id), conversationId, bodyText: string(v.bodyText), status: member(v.status, ["pending", "sending", "sent", "failed", "unknown"]), createdAt: date(v.createdAt), updatedAt: date(v.updatedAt), actorName: string(v.actorName) };
}
export function detailFromResponse(value: unknown, clientId: string, conversationId: string): ConversationDetail {
  const v = record(record(value).conversation), summary = conversationSummary(v, clientId);
  if (summary.id !== conversationId) throw new Error("Conversation data could not be verified.");
  return { ...summary, messages: unique(array(v.messages).map(item => {
    const m = record(item); return { id: id(m.id), direction: member(m.direction, ["sent", "received"]), bodyText: string(m.bodyText), sentAt: date(m.sentAt), senderLabel: string(m.senderLabel) };
  })), commands: unique(array(v.commands).map(item => commandFromResponse(item, conversationId))), messagesTruncated: bool(v.messagesTruncated) };
}
export function replyFromResponse(value: unknown, clientId: string, conversationId: string, input: ReplyInput) {
  const v = record(value), command = commandFromResponse(v.command, conversationId);
  if (command.id !== input.commandId || command.bodyText !== input.bodyText) throw new Error("Reply outcome could not be verified.");
  return { command, conversation: detailFromResponse(v, clientId, conversationId) };
}
export function canReplyInWorkspace(workspace: Workspace, clientId: string): boolean {
  return workspace.enabled && workspace.clientId === clientId && ["agency_owner", "operator", "client_admin", "client_member"].includes(workspace.role || "");
}
export function validConversationSelection(clientId: unknown, conversationId?: unknown): boolean {
  return typeof clientId === "string" && UUID.test(clientId) && (conversationId === undefined || typeof conversationId === "string" && UUID.test(conversationId));
}
export function validReplyInput(value: unknown): ReplyInput | null {
  try {
    const v = record(value), bodyText = string(v.bodyText).trim();
    const input = { clientId: id(v.clientId), commandId: id(v.commandId), expectedVersion: version(v.expectedVersion), latestMessageId: id(v.latestMessageId), bodyText, takeover: bool(v.takeover) };
    return replyBodyError(input) ? null : input;
  } catch { return null; }
}
export function replyBodyError(input: ReplyInput): string | null {
  if (!input.bodyText.trim()) return "Write a reply before sending.";
  if (Array.from(input.bodyText).length > 4000) return "Keep your reply within 4,000 characters.";
  if (new TextEncoder().encode(JSON.stringify(input)).length > 8192) return "This reply is too large. Shorten it before sending.";
  return null;
}
export function validOwnerInput(value: unknown): OwnerInput | null {
  try { const v = record(value); return { clientId: id(v.clientId), expectedVersion: version(v.expectedVersion), owner: member(v.owner, ["me", "covora"]) }; } catch { return null; }
}
export const ownerLabel = (conversation: ConversationSummary) => conversation.owner.kind === "covora" ? "Covora" : conversation.ownedByMe ? "You" : conversation.owner.name || "Teammate";
export const conversationStatusLabel = (status: ConversationSummary["status"]) => ({ needs_reply: "Needs reply", waiting: "Waiting", done: "Done" })[status];
export function replyStatusLabel(status: ReplyStatus): string {
  return ({ pending: "Reply queued", sending: "Sending reply", sent: "Reply accepted for sending", failed: "Reply was not sent", unknown: "Sending outcome unknown" })[status];
}

export type ConversationStage = "needs_action" | "waiting" | "follow_up" | "meeting" | "refused" | "done";
export const FOLLOW_UP_AFTER_DAYS = 3;
export const CONVERSATION_STAGES: readonly { value: ConversationStage; label: string; description: string }[] = [
  { value: "needs_action", label: "Needs your action", description: "Replies waiting on your team, including interested leads and questions." },
  { value: "waiting", label: "Waiting on prospect", description: `Your team replied last, less than ${FOLLOW_UP_AFTER_DAYS} days ago. Nothing to do yet.` },
  { value: "follow_up", label: "Follow-up due", description: `Prospects quiet for ${FOLLOW_UP_AFTER_DAYS}+ days since your last message. Covora drafts a follow-up for each; nothing is sent until you press Send.` },
  { value: "meeting", label: "Meeting confirmed", description: "Prospects with a booked or completed meeting." },
  { value: "refused", label: "Refused", description: "Prospects who declined, were the wrong person, or were lost." },
  { value: "done", label: "Done", description: "Conversations marked as finished." },
];
const MEETING_OUTCOMES = new Set(["Meeting booked", "Meeting completed", "Won"]);
const REFUSED_OUTCOMES = new Set(["Not interested", "Wrong person", "Lost"]);
/** Whole days since the latest message, or null when either time is unusable. */
export function quietDays(latestAt: string, now: string): number | null {
  const elapsed = Date.parse(now) - Date.parse(latestAt);
  return Number.isFinite(elapsed) ? Math.max(0, Math.floor(elapsed / 86_400_000)) : null;
}
/** Each conversation belongs to exactly one stage, so stage tabs never hide a conversation. */
export function conversationStage(item: Pick<ConversationSummary, "status" | "interest" | "latestAt">, now?: string): ConversationStage {
  if (item.status === "done") return "done";
  if (item.interest && MEETING_OUTCOMES.has(item.interest)) return "meeting";
  if (item.interest && REFUSED_OUTCOMES.has(item.interest)) return "refused";
  if (item.status !== "waiting") return "needs_action";
  const days = now ? quietDays(item.latestAt, now) : null;
  return days !== null && days >= FOLLOW_UP_AFTER_DAYS ? "follow_up" : "waiting";
}
export const positiveOutcome = (interest?: string | null) => Boolean(interest && ["Interested", "Meeting booked", "Meeting completed", "Won", "Closed"].includes(interest));

export function filterConversations(items: ConversationSummary[], filters: { search: string; campaign: string; interest: string; status: string; unread: boolean }): ConversationSummary[] {
  const search = filters.search.trim().toLocaleLowerCase();
  return items.filter(item => (!filters.campaign || (item.campaignId || item.campaignName) === filters.campaign) && (!filters.interest || (filters.interest === "unclassified" ? !item.interest : item.interest === filters.interest)) && (!filters.status || item.status === filters.status) && (!filters.unread || item.unread) && (!search || `${item.contactName} ${item.contactAddress}`.toLocaleLowerCase().includes(search)));
}
