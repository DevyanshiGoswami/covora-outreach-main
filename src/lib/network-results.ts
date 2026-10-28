import type { NetworkCampaign } from "./model";
import { clientCampaignName } from "./client-copy";

export function networkTotals(value: unknown): NetworkCampaign["totals"] {
  const source = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
  const read = (key: string) => {
    const count = source[key];
    return typeof count === "number" && Number.isSafeInteger(count) && count >= 0 ? count : null;
  };
  return {
    leads: read("leads"),
    invitations_sent: read("invitations_sent"),
    invitations_accepted: read("invitations_accepted"),
    messages_sent: read("messages_sent"),
    replies: read("replies"),
  };
}

export function networkCampaignName(name: string | null): string {
  return clientCampaignName(name);
}

export function networkFreshness(syncedAt: string | null, now: string): { label: string; stale: boolean } {
  const time = syncedAt ? Date.parse(syncedAt) : NaN;
  if (!Number.isFinite(time)) return { label: "Waiting for the first sync", stale: true };
  const age = Date.parse(now) - time;
  const stale = !Number.isFinite(age) || age > 60 * 60 * 1000;
  const timestamp = new Intl.DateTimeFormat("en-US", {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "UTC",
  }).format(new Date(time));
  return { label: `${stale ? "Update delayed · Last synced" : "Synced"} ${timestamp} UTC`, stale };
}
