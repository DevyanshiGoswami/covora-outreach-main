import type { Lead, Message } from "./model";

export type InboxThread = {
  id: string;
  campaignId: string;
  messages: Message[];
  latest: Message;
  leadName: string;
  leadEmail: string;
  interest: number | null;
  unread: boolean;
  unreadIds: string[];
};

export type InboxFilters = {
  search: string;
  campaign: string;
  interest: string;
  unread: boolean;
};

/** Include campaign ownership in grouping even if two records share a thread key. */
export function inboxThreads(
  messages: Message[],
  leads: Lead[],
  readIds: ReadonlySet<string> = new Set(),
): InboxThread[] {
  const leadByEmail = new Map(
    leads.map((lead) => [
      `${lead.campaign_id}:${lead.email.toLowerCase()}`,
      lead,
    ]),
  );
  const groups = new Map<string, Message[]>();
  for (const message of messages) {
    const key = `${message.campaign_id}:${message.thread_key}`;
    const group = groups.get(key) ?? [];
    group.push(message);
    groups.set(key, group);
  }
  return [...groups]
    .map(([id, group]) => {
      const sorted = [...group].sort(
        (a, b) =>
          a.sent_at.localeCompare(b.sent_at) || a.id.localeCompare(b.id),
      );
      const latest = sorted[sorted.length - 1];
      const latestReceived = [...sorted]
        .reverse()
        .find((message) => message.direction === "received");
      const leadEmail =
        latestReceived?.lead_email ||
        latest.lead_email ||
        latestReceived?.from_email ||
        latest.to_email;
      const lead = leadByEmail.get(
        `${latest.campaign_id}:${leadEmail.toLowerCase()}`,
      );
      const leadName =
        [lead?.first_name, lead?.last_name].filter(Boolean).join(" ") ||
        leadEmail;
      const unreadIds = sorted
        .filter(
          (message) =>
            message.direction === "received" &&
            !message.client_read_at &&
            !readIds.has(message.id),
        )
        .map((message) => message.id);
      return {
        id,
        campaignId: latest.campaign_id,
        messages: sorted,
        latest,
        leadName,
        leadEmail,
        interest: latestReceived?.interest ?? latest.interest,
        unread: unreadIds.length > 0,
        unreadIds,
      };
    })
    .sort(
      (a, b) =>
        b.latest.sent_at.localeCompare(a.latest.sent_at) ||
        a.id.localeCompare(b.id),
    );
}

export function filterInboxThreads(
  threads: InboxThread[],
  filters: InboxFilters,
): InboxThread[] {
  const search = filters.search.trim().toLocaleLowerCase();
  return threads.filter(
    (thread) =>
      (!filters.campaign || thread.campaignId === filters.campaign) &&
      (!filters.interest ||
        (filters.interest === "unclassified"
          ? thread.interest === null
          : thread.interest === Number(filters.interest))) &&
      (!filters.unread || thread.unread) &&
      (!search ||
        `${thread.leadName} ${thread.leadEmail}`
          .toLocaleLowerCase()
          .includes(search)),
  );
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Match the database RPC's bounded, all-or-nothing request shape. */
export function validReadSelection(
  value: unknown,
): { clientId: string; ids: string[] } | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  if (
    typeof input.clientId !== "string" ||
    !UUID.test(input.clientId) ||
    !Array.isArray(input.ids) ||
    input.ids.length < 1 ||
    input.ids.length > 1000 ||
    input.ids.some((id) => typeof id !== "string" || !UUID.test(id))
  )
    return null;
  return { clientId: input.clientId, ids: [...new Set(input.ids as string[])] };
}

/** A stale or mixed client selection must never partly mark the requested set. */
export function completeReadSelection(
  requested: string[],
  rows: { id: string | null }[],
): boolean {
  const allowed = new Set(
    rows.map((row) => row.id).filter((id): id is string => id !== null),
  );
  return requested.length > 0 && requested.every((id) => allowed.has(id));
}
