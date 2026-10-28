import { Network } from "lucide-react";
import type { NetworkCampaign } from "@/lib/model";
import { number, CAMPAIGN_LABELS } from "@/lib/metrics";
import { networkFreshness } from "@/lib/network-results";

const metrics = [
  ["leads", "Contacts in campaign"],
  ["invitations_sent", "Invitations sent"],
  ["invitations_accepted", "Invitations accepted"],
  ["messages_sent", "Messages sent"],
  ["replies", "Replies"],
] as const;

/** Campaign-reported totals remain distinct from email results and manual logs. */
export function NetworkCampaignResults({ campaigns, unavailable = false, now }: {
  campaigns: NetworkCampaign[];
  unavailable?: boolean;
  now: string;
}) {
  return <section className="network-results" aria-label="Live LinkedIn campaign results">
    <div className="panel-heading">
      <div><span className="eyebrow"><Network size={14} aria-hidden="true" /> LINKEDIN OUTREACH</span><h2>LinkedIn campaigns</h2><p className="muted">Campaign-reported, all-time activity. Separate from email and manually logged results.</p></div>
    </div>
    {unavailable ? <div className="notice" role="status">LinkedIn campaign results are temporarily unavailable. This page will check again automatically.</div> : campaigns.length === 0 ? <div className="panel empty-state"><h3>No LinkedIn campaigns connected yet</h3><p>Campaigns and their reported results will appear here after the first sync.</p></div> : campaigns.map((campaign) => {
      const freshness = networkFreshness(campaign.synced_at, now);
      const pending = metrics.slice(1).every(([key]) => campaign.totals[key] === null);
      return <article className="panel network-campaign" key={campaign.id}>
        <div className="panel-heading"><div><h3>{campaign.name}</h3><p className="network-freshness" data-stale={freshness.stale}>{freshness.label}</p></div><span className={`status ${campaign.status === "active" ? "status-green" : "status-blue"}`}><i />{CAMPAIGN_LABELS[campaign.status] || "Unknown"}</span></div>
        <dl className="network-metrics">{metrics.map(([key, label]) => <div key={key}><dt>{label}</dt><dd>{campaign.totals[key] === null ? <span aria-label="Not reported">—</span> : number(campaign.totals[key])}</dd></div>)}</dl>
        {pending && <p className="chart-note">Awaiting the first activity report. An active campaign may still be waiting for its scheduled sending window.</p>}
        <p className="chart-note">{campaign.schedule.windows?.length ? campaign.schedule.windows.map((window) => `${window.days.map((day) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][day]).join(", ")} · ${window.from}–${window.to} · ${window.timezone}`).join("; ") : "Sending schedule is managed by your Covora team."}</p>
      </article>;
    })}
    {campaigns.length > 0 && <p className="chart-note">A dash means a result has not been reported; 0 means a reported zero. Invitation acceptance and replies are separate events. Campaign totals may count the same person in more than one campaign.</p>}
  </section>;
}
