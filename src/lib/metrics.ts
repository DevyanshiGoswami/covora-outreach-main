import type { Campaign, Daily, DateRange } from "./model";

export function count(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, value)
    : 0;
}
export function rate(numerator: unknown, denominator: unknown): number {
  const total = count(denominator);
  return total > 0 ? Math.min(1, count(numerator) / total) : 0;
}
/** JSON schedule dates must be real UTC calendar days before formatting. */
export function isCalendarDay(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return (
    Number.isFinite(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}
export function humanReplies(totals: Record<string, number>) {
  return Math.max(
    0,
    count(totals.unique_replies) - count(totals.unique_auto_replies),
  );
}
export function campaignTotals(campaigns: Campaign[]) {
  return campaigns.reduce(
    (all, c) => {
      for (const key of [
        "leads",
        "contacted",
        "sent",
        "positive_replies",
        "bounced",
        "opportunities",
        "completed",
      ])
        all[key] += count(c.totals[key]);
      all.replies += humanReplies(c.totals);
      return all;
    },
    {
      leads: 0,
      contacted: 0,
      sent: 0,
      positive_replies: 0,
      bounced: 0,
      opportunities: 0,
      completed: 0,
      replies: 0,
    } as Record<string, number>,
  );
}
export function rangeStart(range: DateRange, now: string): string | null {
  if (range === "all" || !isCalendarDay(now.slice(0, 10))) return null;
  const date = new Date(`${now.slice(0, 10)}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - (range === "7d" ? 6 : 29));
  return date.toISOString().slice(0, 10);
}
export function inRange(day: string, range: DateRange, now: string): boolean {
  const today = now.slice(0, 10);
  if (!isCalendarDay(day) || !isCalendarDay(today)) return false;
  const start = rangeStart(range, now);
  return (!start || day >= start) && day <= today;
}
export function chartDays(rows: Daily[], range: DateRange, now: string) {
  const groups = new Map<
    string,
    { day: string; sent: number; replies: number; contacted: number }
  >();
  for (const row of rows.filter((r) => inRange(r.day, range, now))) {
    const point = groups.get(row.day) || {
      day: row.day,
      sent: 0,
      replies: 0,
      contacted: 0,
    };
    point.sent += count(row.sent);
    point.replies += count(row.unique_replies);
    point.contacted += count(row.new_contacted);
    groups.set(row.day, point);
  }
  return [...groups.values()].sort((a, b) => a.day.localeCompare(b.day));
}
export const CAMPAIGN_LABELS: Record<string, string> = {
  draft: "Draft",
  active: "Active",
  paused: "Paused",
  completed: "Completed",
  running_subsequences: "Following up",
  accounts_unhealthy: "Needs attention",
  bounce_protection: "Paused for delivery",
  suspended: "Suspended",
  unknown: "Unknown",
};
export const LEAD_LABELS: Record<string, string> = {
  not_contacted: "Not yet contacted",
  in_sequence: "In sequence",
  replied: "Replied",
  bounced: "Bounced",
  unsubscribed: "Unsubscribed",
  skipped: "Skipped",
  paused: "Paused",
  completed: "Completed",
  unknown: "Unknown",
};
export const INTEREST_LABELS: Record<number, string> = {
  0: "Out of office",
  1: "Interested",
  2: "Meeting booked",
  3: "Meeting completed",
  4: "Won",
  "-1": "Not interested",
  "-2": "Wrong person",
  "-3": "Lost",
  "-4": "No show",
};
export const interestLabel = (value: number | null) =>
  INTEREST_LABELS[value ?? NaN] || "Not classified";
export const number = (value: number) =>
  new Intl.NumberFormat("en-US").format(value);
export const percent = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "percent",
    maximumFractionDigits: 1,
  }).format(value);
export const shortDate = (value: string) =>
  Number.isFinite(Date.parse(value))
    ? new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      }).format(new Date(value))
    : "—";
