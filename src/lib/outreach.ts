const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const STATUSES = ["queued", "creating", "scheduled", "sent", "failed", "unknown"] as const;

export type OutreachStatus = typeof STATUSES[number];
export type OutreachProspect = { id: string; name: string; email: string; company: string };
export type OutreachSender = { connectionId: string; address: string; label: string };
export type OutreachOptions = { prospects: OutreachProspect[]; senders: OutreachSender[]; sendingEnabled: boolean };
export type Outreach = {
  id: string; clientId: string; status: OutreachStatus; recipientEmail: string; recipientName: string;
  senderAddress: string; subject: string; createdAt: string; updatedAt: string; conversationId: string | null;
};
export type OutreachInput = { clientId: string; sendId: string; recipientEmail: string; connectionId: string; subject: string; bodyText: string };
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const text = (value: unknown, max: number): value is string => typeof value === "string" && value.length <= max;
const id = (value: unknown): value is string => typeof value === "string" && UUID.test(value);
const time = (value: unknown): value is string => typeof value === "string" && Number.isFinite(Date.parse(value));

export function outreachStatusLabel(status: OutreachStatus): string {
  return { queued: "Starting", creating: "Starting", scheduled: "Queued for sending", sent: "Sent", failed: "Not sent", unknown: "Outcome unconfirmed, do not resend" }[status];
}

/** Only a confirmed failure invites another attempt; an unknown outcome may already have been delivered. */
export function outreachOutcomeNotice(item: Pick<Outreach, "status" | "recipientEmail">): string {
  if (item.status === "failed") return "The outreach was not sent. Check the sender connection and try again.";
  if (item.status === "unknown") return `${outreachStatusLabel(item.status)}: ${item.recipientEmail}. It may still be delivered, so use Refresh status instead of starting again.`;
  return `${outreachStatusLabel(item.status)}: ${item.recipientEmail}. Replies appear in the Inbox.`;
}

export type OutreachFormErrors = Partial<Record<"recipientEmail" | "subject" | "bodyText", string>>;
export function outreachFormErrors(form: { recipientEmail: string; subject: string; bodyText: string }): OutreachFormErrors {
  const errors: OutreachFormErrors = {};
  const email = form.recipientEmail.trim();
  if (!email) errors.recipientEmail = "Enter the recipient's email address.";
  else if (email.length > 254 || !EMAIL.test(email)) errors.recipientEmail = "Enter a valid email address, like name@company.com.";
  if (!form.subject.trim()) errors.subject = "Enter a subject.";
  else if (/[\r\n]/.test(form.subject)) errors.subject = "Keep the subject on one line.";
  if (!form.bodyText.trim()) errors.bodyText = "Write a message.";
  else if ([...form.bodyText.trim()].length > 4000) errors.bodyText = "Keep the message within 4,000 characters.";
  return errors;
}

export function validOutreachInput(value: unknown): OutreachInput | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Record<string, unknown>;
  const subject = typeof input.subject === "string" ? input.subject.trim() : "";
  const bodyText = typeof input.bodyText === "string" ? input.bodyText.trim() : "";
  const recipientEmail = typeof input.recipientEmail === "string" ? input.recipientEmail.trim().toLowerCase() : "";
  if (!id(input.clientId) || !id(input.sendId) || !id(input.connectionId) || recipientEmail.length > 254 || !EMAIL.test(recipientEmail)
    || !subject || subject.length > 500 || /[\r\n]/.test(subject) || !bodyText || [...bodyText].length > 4000) return null;
  return { clientId: input.clientId, sendId: input.sendId, recipientEmail, connectionId: input.connectionId, subject, bodyText };
}

function outreachItem(value: unknown, clientId: string): Outreach {
  const item = value as Record<string, unknown> | null;
  if (!item || !id(item.id) || item.clientId !== clientId || !STATUSES.includes(item.status as OutreachStatus)
    || !text(item.recipientEmail, 254) || !text(item.recipientName, 1001) || !text(item.senderAddress, 254) || !text(item.subject, 500)
    || !time(item.createdAt) || !time(item.updatedAt) || !(item.conversationId === null || id(item.conversationId))) throw new Error("Invalid outreach");
  return { id: item.id, clientId, status: item.status as OutreachStatus, recipientEmail: item.recipientEmail, recipientName: item.recipientName,
    senderAddress: item.senderAddress, subject: item.subject, createdAt: item.createdAt, updatedAt: item.updatedAt, conversationId: item.conversationId as string | null };
}

export function outreachListFromResponse(value: unknown, clientId: string): Outreach[] {
  const items = (value as { outreach?: unknown } | null)?.outreach;
  if (!Array.isArray(items) || items.length > 25) throw new Error("Invalid outreach list");
  return items.map(item => outreachItem(item, clientId));
}

export function outreachFromResponse(value: unknown, clientId: string, sendId: string): Outreach {
  const item = outreachItem((value as { outreach?: unknown } | null)?.outreach, clientId);
  if (item.id !== sendId) throw new Error("Unexpected outreach");
  return item;
}

export function outreachOptionsFromResponse(value: unknown): OutreachOptions {
  const data = value as { prospects?: unknown; senders?: unknown; sendingEnabled?: unknown } | null;
  if (!data || !Array.isArray(data.prospects) || data.prospects.length > 500 || !Array.isArray(data.senders) || data.senders.length > 100 || typeof data.sendingEnabled !== "boolean") throw new Error("Invalid options");
  const prospects = data.prospects.map(raw => {
    const item = raw as Record<string, unknown>;
    if (!id(item?.id) || !text(item.name, 1001) || !text(item.email, 254) || !text(item.company, 500)) throw new Error("Invalid prospect");
    return { id: item.id, name: item.name, email: item.email, company: item.company };
  });
  const senders = data.senders.map(raw => {
    const item = raw as Record<string, unknown>;
    if (!id(item?.connectionId) || !text(item.address, 254) || !text(item.label, 200)) throw new Error("Invalid sender");
    return { connectionId: item.connectionId, address: item.address, label: item.label };
  });
  return { prospects, senders, sendingEnabled: data.sendingEnabled };
}
