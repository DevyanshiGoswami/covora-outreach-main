import type { ResultsData } from "./model";
import { interestLabel } from "./metrics";
import { inboxThreads } from "./inbox";
import type { ConversationDetail, ConversationPage } from "./conversations";
export function demoConversations(data: ResultsData, clientId: string): { page: ConversationPage; details: ConversationDetail[] } {
  const details: ConversationDetail[] = inboxThreads(data.messages, data.leads).map((thread, index) => ({
    id: `70000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`, clientId, channel: "email", campaignId: thread.campaignId,
    campaignName: data.campaigns.find(c => c.id === thread.campaignId)?.name || "Campaign", subject: thread.latest.subject,
    contactName: thread.leadName, contactAddress: thread.leadEmail, senderLabel: "hello@example.com", owner: { kind: "covora", userId: null, name: "Covora" },
    ownedByMe: false, version: 1, latestMessageId: thread.latest.id, latestAt: thread.latest.sent_at, preview: thread.latest.body_text, unread: thread.unread,
    status: thread.latest.direction === "sent" ? "waiting" : "needs_reply", interest: thread.interest === null ? null : interestLabel(thread.interest), canReply: true, canTakeover: true, replyUnavailableReason: null,
    messages: thread.messages.map(message => ({ id: message.id, direction: message.direction === "sent" ? "sent" : "received", bodyText: message.body_text, sentAt: message.sent_at, senderLabel: message.from_email })), commands: [], messagesTruncated: false,
  }));
  details.unshift({ id: "70000000-0000-4000-8000-000000000099", clientId, channel: "linkedin", campaignId: null, campaignName: "Founder conversations", subject: "A more consistent presence", contactName: "Jamie Parker", contactAddress: "Jamie Parker · Northstar", senderLabel: "Alex Carter", owner: { kind: "covora", userId: null, name: "Covora" }, ownedByMe: false, version: 1, latestMessageId: "71000000-0000-4000-8000-000000000099", latestAt: "2026-10-03T18:30:00Z", preview: "Thanks for connecting. Could you share a little more about how your team works?", unread: true, status: "needs_reply", canReply: true, canTakeover: true, replyUnavailableReason: null, messages: [{ id: "71000000-0000-4000-8000-000000000099", direction: "received", bodyText: "Thanks for connecting. Could you share a little more about how your team works?", sentAt: "2026-10-03T18:30:00Z", senderLabel: "Jamie Parker" }], commands: [], messagesTruncated: false });
  // Synthetic thread that has gone quiet, so the development demo shows a follow-up due.
  details.push({ id: "70000000-0000-4000-8000-000000000098", clientId, channel: "email", campaignId: null, campaignName: "Clinic introductions", subject: "Following up", contactName: "Dr. Morgan Lee", contactAddress: "morgan@example.com", senderLabel: "hello@example.com", owner: { kind: "covora", userId: null, name: "Covora" }, ownedByMe: false, version: 1, latestMessageId: "71000000-0000-4000-8000-000000000098", latestAt: "2026-09-27T10:00:00Z", preview: "Hi Morgan, we help clinics share patient-style creator content. Open to a quick look?", unread: false, status: "waiting", interest: null, canReply: true, canTakeover: true, replyUnavailableReason: null, messages: [{ id: "71000000-0000-4000-8000-000000000098", direction: "sent", bodyText: "Hi Morgan, we help clinics share patient-style creator content. Open to a quick look?", sentAt: "2026-09-27T10:00:00Z", senderLabel: "hello@example.com" }], commands: [], messagesTruncated: false });
  return { page: { conversations: details, nextCursor: null }, details };
}
