import type { Campaign } from "./model";
import { count, humanReplies, rate } from "./metrics";

export function analyticsAvailability(totals: unknown): boolean | undefined {
  if (!totals || typeof totals !== "object" || Array.isArray(totals)) return undefined;
  const value = (totals as Record<string, unknown>).analytics_available;
  return typeof value === "boolean" ? value : undefined;
}

const hasMetric = (campaign: Campaign, key: string) =>
  typeof campaign.totals[key] === "number" && Number.isFinite(campaign.totals[key]);

/** An explicit unavailable result must not turn a missing measurement into zero. */
export function campaignMetric(campaign: Campaign, key: string): number | null {
  if (key === "replies") {
    if (campaign.analyticsAvailable === false &&
        (!hasMetric(campaign, "unique_replies") || !hasMetric(campaign, "unique_auto_replies"))) return null;
    return humanReplies(campaign.totals);
  }
  if (campaign.analyticsAvailable === false && !hasMetric(campaign, key)) return null;
  return count(campaign.totals[key]);
}

export function reportedRate(numerator: number | null, denominator: number | null) {
  return numerator === null || denominator === null ? null : rate(numerator, denominator);
}

export function reportedCampaignTotals(campaigns: Campaign[]): Record<string, number | null> {
  return Object.fromEntries(["contacted", "replies", "positive_replies", "opportunities"].map((key) => {
    const values = campaigns.map((campaign) => campaignMetric(campaign, key));
    const reported = values.filter((value): value is number => value !== null);
    return [key, values.length && !reported.length ? null : reported.reduce((sum, value) => sum + value, 0)];
  }));
}

export function reportedCampaignReplyRate(campaigns: Campaign[]): number | null {
  if (campaigns.some((campaign) =>
    (campaignMetric(campaign, "replies") === null) !== (campaignMetric(campaign, "contacted") === null))) return null;
  const totals = reportedCampaignTotals(campaigns);
  return reportedRate(totals.replies, totals.contacted);
}

export function campaignResultsLabel(campaign: Campaign): "Results pending" | "Last reported" | null {
  if (campaign.analyticsAvailable !== false) return null;
  // Positive replies are measured from leads separately from campaign analytics.
  const hasReportedResults = ["leads", "contacted", "sent", "unique_replies", "unique_auto_replies", "bounced", "opportunities", "completed"]
    .some((key) => hasMetric(campaign, key));
  return hasReportedResults ? "Last reported" : "Results pending";
}

export function resultsAvailabilityNote(campaigns: Campaign[]): string | null {
  const notes = [];
  for (const status of ["draft", "active"] as const) {
    const group = campaigns.filter((campaign) => campaign.status === status);
    const pending = group.filter((campaign) => campaignResultsLabel(campaign) === "Results pending").length;
    const previous = group.filter((campaign) => campaignResultsLabel(campaign) === "Last reported").length;
    if (status === "draft") {
      if (pending) notes.push(`${pending} ${pending === 1 ? "draft has" : "drafts have"} no reported results yet.`);
      if (previous) notes.push(`${previous} ${previous === 1 ? "draft shows" : "drafts show"} last reported results.`);
    } else {
      if (pending) notes.push(`Results are pending for ${pending} active ${pending === 1 ? "campaign" : "campaigns"}.`);
      if (previous) notes.push(`${previous} active ${previous === 1 ? "campaign shows" : "campaigns show"} last reported results.`);
      if (pending || previous) notes.push("Totals include available measurements only.");
    }
  }
  return notes.join(" ") || null;
}
