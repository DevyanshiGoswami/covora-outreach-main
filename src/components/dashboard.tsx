import { NavigationLink as Link } from "./navigation-link";
import {
  ArrowRight,
  ChevronLeft,
  Clock3,
  Network,
  LockKeyhole,
  Users,
  MessageSquare,
  ThumbsUp,
  Target,
} from "lucide-react";
import type {
  Campaign,
  ResultsData,
  Selection,
  WorkspaceInfo,
} from "@/lib/model";
import {
  CAMPAIGN_LABELS,
  chartDays,
  inRange,
  number,
  percent,
  shortDate,
} from "@/lib/metrics";
import { campaignResultsLabel, reportedCampaignReplyRate, reportedCampaignTotals, resultsAvailabilityNote } from "@/lib/results-availability";
import { workspaceUrl } from "@/lib/navigation";
import {
  CampaignTable,
  LeadsTable,
} from "./controls";
import { ActivityChart } from "./chart";
import { WorkspaceShell } from "./workspace-shell";
import { Inbox } from "./inbox";
import { ConversationInbox } from "./conversation-inbox";
import type { ConversationDetail, ConversationPage } from "@/lib/conversations";
import { ReadStateProvider } from "./read-state";
import { showWorkspaceWelcome } from "@/lib/overview";
import { WorkspaceWelcome } from "./workspace-welcome";
import { activeCampaignResults } from "@/lib/workspace-results-policy";
import { ResultsRefresh } from "./results-refresh";
import { refreshLiveResults } from "@/lib/results-refresh";
import { NetworkCampaignResults } from "./network-campaign-results";

type Props = {
  data: ResultsData;
  workspace: WorkspaceInfo;
  selection: Selection;
  demo?: boolean;
  preview?: boolean;
  now: string;
  conversations?: ConversationPage | null;
  conversationError?: string;
  demoConversations?: ConversationDetail[];
};
function Kpis({ campaigns, preview = false }: { campaigns: Campaign[]; preview?: boolean }) {
  const t = reportedCampaignTotals(campaigns);
  const replyRate = reportedCampaignReplyRate(campaigns);
  const availabilityNote = resultsAvailabilityNote(campaigns);
  const resultLabel = campaigns.length === 1 ? campaignResultsLabel(campaigns[0]) : null;
  const metricNumber = (value: number | null) => value === null ? "—" : number(value);
  const metrics = [
    { label: "People contacted", value: metricNumber(t.contacted), note: campaigns.length === 1 ? "In this campaign" : "Across campaigns", icon: Users },
    { label: "Human replies", value: metricNumber(t.replies), note: replyRate === null ? "Reply rate pending" : `${percent(replyRate)} reply rate`, icon: MessageSquare },
    { label: "Positive replies", value: metricNumber(t.positive_replies), note: "Interested prospects", icon: ThumbsUp },
    { label: preview ? "Meetings booked" : "Opportunities", value: metricNumber(t.opportunities), note: preview ? "Sample meetings" : "Reported by campaigns", icon: Target },
  ];
  return <section className="results-summary" aria-label="All-time campaign results">
    <div className="results-summary-heading"><h2>{preview ? "Performance at a glance" : "Email performance at a glance"}</h2><span>{preview ? "Sample results" : resultLabel || "All-time results"}</span></div>
    <div className="kpis">{metrics.map((metric) => <article className="kpi" key={metric.label}><div className="kpi-label"><span>{metric.label}</span><span className="kpi-icon"><metric.icon size={17} aria-hidden="true" /></span></div><strong>{metric.value}</strong><small>{metric.note}</small></article>)}</div>
    {!preview && availabilityNote && <p className="metric-definitions">{availabilityNote}</p>}
    <details className="metric-definitions"><summary>About these numbers</summary>{preview ? <p>These are illustrative results for this preview, including sample meetings. They do not represent actual outreach, responses, or booked calls.</p> : <p>Campaign totals are all time. People are counted within each campaign; the same person can appear in more than one. Human replies exclude automatic replies. Reply rate is human replies divided by people contacted. Opportunities are campaign-reported, and may not represent booked meetings. The activity chart shows reported daily activity for its selected period.</p>}</details>
  </section>;
}
function Ranges({ selection, demo }: { selection: Selection; demo: boolean }) {
  return (
    <div className="range-control" aria-label="Activity date range">
      {(["7d", "30d", "all"] as const).map((r) => (
        <Link
          key={r}
          aria-current={selection.range === r ? "true" : undefined}
          className={selection.range === r ? "selected" : ""}
          href={workspaceUrl(selection, { range: r }, demo)}
        >
          {r === "all" ? "All time" : r === "7d" ? "7 days" : "30 days"}
        </Link>
      ))}
    </div>
  );
}
function ChartPanel({
  data,
  selection,
  demo,
  now,
}: {
  data: ResultsData;
  selection: Selection;
  demo: boolean;
  now: string;
}) {
  const points = chartDays(data.daily, selection.range, now);
  const resultsPending = points.length === 0 && data.campaigns.length > 0 &&
    data.campaigns.every((campaign) => campaign.analyticsAvailable === false);
  return (
    <section className="panel activity-panel">
      <div className="panel-heading">
        <div>
          <h2>Outreach activity</h2>
          <p className="muted">Daily email activity · UTC</p>
        </div>
        <Ranges selection={selection} demo={demo} />
      </div>
      <div className="chart-totals">
        <div>
          <span><i className="series-marker series-sent" aria-hidden="true" />Emails sent in period</span>
          <strong>{resultsPending ? "—" : number(points.reduce((s, p) => s + p.sent, 0))}</strong>
        </div>
        <div>
          <span><i className="series-marker series-replies" aria-hidden="true" />Reported replies in period</span>
          <strong>{resultsPending ? "—" : number(points.reduce((s, p) => s + p.replies, 0))}</strong>
        </div>
      </div>
      {resultsPending ? <div className="empty-state"><h3>Results pending</h3><p>Daily results have not been reported for this period.</p></div> : <ActivityChart daily={data.daily} range={selection.range} now={now} />}
    </section>
  );
}
function Overview({ data, workspace, selection, demo, preview, now }: Props & { demo: boolean }) {
  const activeOnly = !demo && !preview && activeCampaignResults(workspace.clientId, "overview");
  if (showWorkspaceWelcome(workspace, data)) return <WorkspaceWelcome workspace={workspace} demo={demo} />;
  if (activeOnly && !data.campaigns.length && !data.networkCampaigns.length && !data.networkUnavailable) return <section className="panel"><CampaignTable campaigns={[]} selection={selection} demo={demo} compact activeOnly /></section>;
  return (
    <>
      <Kpis campaigns={data.campaigns} preview={preview} />
      {!demo && !preview && (data.networkCampaigns.length > 0 || data.networkUnavailable) && <NetworkCampaignResults campaigns={data.networkCampaigns} unavailable={data.networkUnavailable} now={now} />}
      <ChartPanel data={data} selection={selection} demo={demo} now={now} />
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>{activeOnly ? "Active campaigns" : "Campaigns"}</h2>
            <p className="muted">{activeOnly ? "Results from campaigns that are currently active." : "A closer look at your outreach."}</p>
          </div>
          <Link
            className="text-link"
            href={workspaceUrl(
              selection,
              { view: "campaigns", campaign: "" },
              demo,
            )}
          >
            View all <ArrowRight size={15} />
          </Link>
        </div>
        <CampaignTable
          campaigns={data.campaigns.slice(0, 4)}
          selection={selection}
          demo={demo}
          compact
          activeOnly={activeOnly}
        />
      </section>
    </>
  );
}
function CampaignDetail({
  data,
  workspace,
  selection,
  demo,
  now,
}: Props & { demo: boolean }) {
  const activeOnly = !demo && activeCampaignResults(workspace.clientId, "campaigns");
  const campaign = data.campaigns.find((c) => c.id === selection.campaign);
  if (!campaign)
    return (
      <section className="panel empty-state">
        <h2>Campaign unavailable</h2>
        <p>{activeOnly ? "This campaign is not currently active in this workspace." : "This campaign is not part of the selected workspace."}</p>
        <Link
          className="text-link"
          href={workspaceUrl(selection, { campaign: "" }, demo)}
        >
          Back to campaigns
        </Link>
      </section>
    );
  const filtered = {
    ...data,
    campaigns: [campaign],
    daily: data.daily.filter((d) => d.campaign_id === campaign.id),
  };
  const steps = data.steps.filter((s) => s.campaign_id === campaign.id);
  return (
    <>
      <div className="detail-heading">
        <Link
          className="back-link"
          href={workspaceUrl(selection, { campaign: "" }, demo)}
        >
          <ChevronLeft size={16} />
          {activeOnly ? "Active campaigns" : "All campaigns"}
        </Link>
        <div>
          <h2>{campaign.name}</h2>
          <span
            className={`status ${campaign.status === "active" ? "status-green" : "status-blue"}`}
          >
            <i />
            {CAMPAIGN_LABELS[campaign.status] || "Unknown"}
          </span>
        </div>
      </div>
      <nav className="detail-tabs" aria-label="Campaign sections">
        {(["analytics", "leads", "sequence", "schedule"] as const).map(
          (tab) => (
            <Link
              key={tab}
              className={selection.tab === tab ? "active" : ""}
              aria-current={selection.tab === tab ? "page" : undefined}
              href={workspaceUrl(selection, { tab }, demo)}
            >
              {tab[0].toUpperCase() + tab.slice(1)}
            </Link>
          ),
        )}
      </nav>
      {selection.tab === "analytics" && (
        <>
          <Kpis campaigns={[campaign]} />
          <ChartPanel
            data={filtered}
            selection={selection}
            demo={demo}
            now={now}
          />
          <section className="panel">
            <div className="panel-heading">
              <div>
                <h2>Sequence performance</h2>
                <p className="muted">Results by step and variant.</p>
              </div>
            </div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Step</th>
                    <th>Subject</th>
                    <th>Sent</th>
                    <th>Reported replies</th>
                  </tr>
                </thead>
                <tbody>
                  {steps.map((s) => (
                    <tr key={`${s.step}-${s.variant}`}>
                      <td>
                        Step {s.step}
                        {s.variant > 0 ? ` · Variant ${s.variant + 1}` : ""}
                      </td>
                      <td>{s.subject || "No subject"}</td>
                      <td>
                        {s.stats.sent == null ? "—" : number(s.stats.sent)}
                      </td>
                      <td>
                        {s.stats.unique_replies == null
                          ? "—"
                          : number(s.stats.unique_replies)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="chart-note">
              A dash means step-level results are not available yet.
            </p>
          </section>
        </>
      )}
      {selection.tab === "leads" && (
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Campaign leads</h2>
              <p className="muted">
                Contact progress and the latest reported interest.
              </p>
            </div>
            <span className="pill">Read only</span>
          </div>
          <LeadsTable
            leads={data.leads.filter((l) => l.campaign_id === campaign.id)}
          />
        </section>
      )}
      {selection.tab === "sequence" && (
        <div className="sequence-list">
          {steps.length ? (
            steps.map((s) => (
              <section
                key={`${s.step}-${s.variant}`}
                className="panel sequence-card"
              >
                <div className="step-rail">
                  <span>{s.step}</span>
                </div>
                <div className="sequence-content">
                  <div className="panel-heading">
                    <div>
                      <span className="eyebrow">
                        STEP {s.step} · VARIANT {s.variant + 1}
                      </span>
                      <h2>{s.subject || "No subject"}</h2>
                    </div>
                    <span className="pill">
                      <Clock3 size={13} />
                      {s.delay_days
                        ? `Wait ${s.delay_days} days after this step`
                        : "No delay after this step"}
                    </span>
                  </div>
                  <div className="message-body">
                    {s.body_text || "No message text is available."}
                  </div>
                </div>
              </section>
            ))
          ) : (
            <section className="panel empty-state">
              <h2>Sequence not available yet</h2>
              <p>Your campaign’s message steps will appear after syncing.</p>
            </section>
          )}
        </div>
      )}
      {selection.tab === "schedule" && (
        <section className="panel schedule-panel">
          <div className="panel-heading">
            <div>
              <h2>Sending schedule</h2>
              <p className="muted">
                The hours your campaign is scheduled to run.
              </p>
            </div>
            <span className="pill">Read only</span>
          </div>
          {campaign.schedule.windows?.length ? (
            campaign.schedule.windows.map((w, i) => (
              <div className="schedule-window" key={i}>
                <div className="schedule-time">
                  <Clock3 size={22} />
                  <div>
                    <strong>
                      {w.from} – {w.to}
                    </strong>
                    <span>{w.timezone}</span>
                  </div>
                </div>
                <div className="weekdays">
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                    (day, d) => (
                      <span
                        className={w.days.includes(d) ? "enabled" : ""}
                        key={day}
                      >
                        {day}
                        <small>{w.days.includes(d) ? "On" : "Off"}</small>
                      </span>
                    ),
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="empty-state">
              <h3>No sending window available</h3>
              <p>The schedule will appear after the campaign syncs.</p>
            </div>
          )}
          <div className="schedule-dates">
            <div>
              <span>Start date</span>
              <strong>
                {campaign.schedule.start_date
                  ? shortDate(campaign.schedule.start_date)
                  : "Not specified"}
              </strong>
            </div>
            <div>
              <span>End date</span>
              <strong>
                {campaign.schedule.end_date
                  ? shortDate(campaign.schedule.end_date)
                  : "Not specified"}
              </strong>
            </div>
          </div>
        </section>
      )}
    </>
  );
}
function LinkedInResults({
  data,
  selection,
  demo,
  preview,
  now,
}: Props & { demo: boolean }) {
  const rows = data.linkedin.filter((d) =>
    inRange(d.day, selection.range, now),
  );
  return (
    <>
      {!demo && !preview && <NetworkCampaignResults campaigns={data.networkCampaigns} unavailable={data.networkUnavailable} now={now} />}
      {(demo || preview || data.linkedin.length > 0) && <>
      <div className="panel-heading linkedin-heading">
        <span className="pill">
          <Network size={14} />
          Logged by you
        </span>
        <Ranges selection={selection} demo={demo} />
      </div>
      <div className="notice neutral-notice">
        These numbers come from your team’s activity logs. They are separate
        from email campaign results.
      </div>
      <div className="linkedin-grid">
        {[
          {
            key: "outreach_log",
            title: "Confirmed LinkedIn sends",
            description: "Messages and connection requests marked as sent.",
          },
          {
            key: "dm_log",
            title: "LinkedIn DM log",
            description: "DMs grouped by the day they were originally logged.",
          },
        ].map((source) => {
          const sourceRows = rows.filter((r) => r.source === source.key);
          const sum = (key: "sent" | "replied" | "meeting_booked") =>
            sourceRows.reduce((a, r) => a + (r[key] || 0), 0);
          return (
            <section className="panel" key={source.key}>
              <span className="eyebrow">LOGGED BY YOU</span>
              <h2>{source.title}</h2>
              <p className="muted">{source.description}</p>
              <div className="linkedin-metrics">
                <div>
                  <strong>{number(sum("sent"))}</strong>
                  <span>Messages logged as sent</span>
                </div>
                <div>
                  <strong>
                    {source.key === "outreach_log"
                      ? "—"
                      : number(sum("replied"))}
                  </strong>
                  <span>Currently marked replied</span>
                </div>
                <div>
                  <strong>
                    {source.key === "outreach_log"
                      ? "—"
                      : number(sum("meeting_booked"))}
                  </strong>
                  <span>Currently marked meeting booked</span>
                </div>
              </div>
              <p className="chart-note">
                {source.key === "outreach_log"
                  ? "This log does not record replies or meetings."
                  : "Outcomes reflect the current status of each logged DM, not the date a reply or meeting happened. Each status is counted separately."}
              </p>
              {!sourceRows.length && (
                <p className="muted">No activity logged for this period.</p>
              )}
            </section>
          );
        })}
      </div>
      <p className="chart-note">
        The two logs may contain the same conversation. They are shown
        separately to avoid counting a person twice.
      </p>
      </>}
    </>
  );
}
export function Dashboard({
  data,
  workspace,
  selection,
  demo = false,
  preview = false,
  now,
  conversations,
  conversationError,
  demoConversations,
}: Props) {
  const activeOnly = !demo && !preview && activeCampaignResults(workspace.clientId, selection.view);
  const autoRefresh = refreshLiveResults(selection.view, demo, preview);
  const title = activeOnly && selection.view === "campaigns" ? "Active campaigns" : { overview: "Overview", campaigns: "Campaigns", inbox: "Inbox", linkedin: "LinkedIn" }[selection.view];
  const syncs = data.campaigns
    .filter((campaign) => selection.view !== "campaigns" || !selection.campaign || campaign.id === selection.campaign)
    .map((c) => c.synced_at)
    .filter((s): s is string => Boolean(s))
    .sort();
  const latest = syncs.at(-1);
  return (
    <ReadStateProvider key={`${workspace.clientId}:${demo ? "demo" : preview ? "preview" : "live"}`}>
      <WorkspaceShell workspace={workspace} active={selection.view} title={title} subtitle={{ overview: "Your outreach performance, all in one place.", campaigns: activeOnly ? "Follow the progress of your active campaigns." : "Follow the progress of every campaign.", inbox: "Every conversation. One clear workspace.", linkedin: preview ? "Explore sample LinkedIn conversations." : "Follow your LinkedIn outreach and results." }[selection.view]} demo={demo}>
          {!workspace.enabled ? (
            <section className="panel empty-state">
              <LockKeyhole size={28} />
              <h2>Outbound access is not enabled for this account.</h2>
              <p>Ask your account manager to review your workspace membership.</p>
            </section>
          ) : (
            <>
              {autoRefresh && <ResultsRefresh key={`${workspace.clientId}:${selection.view}:${selection.campaign}:${selection.tab}`} />}
              {data.truncated && !conversations && (
                <div className="notice">
                  This view reached its record limit. Displayed totals and
                  detailed rows may be partial.
                </div>
              )}
              {selection.view === "overview" && (
                <Overview
                  data={data}
                  workspace={workspace}
                  selection={selection}
                  demo={demo}
                  preview={preview}
                  now={now}
                />
              )}{" "}
              {selection.view === "campaigns" &&
                (selection.campaign ? (
                  <CampaignDetail
                    data={data}
                    workspace={workspace}
                    selection={selection}
                    demo={demo}
                    now={now}
                  />
                ) : (
                  <>
                    <div className="campaign-list-summary">
                      <strong>{data.campaigns.length} {activeOnly ? "active email campaigns" : "email campaigns"}</strong>
                      <span className="muted">All-time results</span>
                    </div>
                    <section className="panel">
                      <CampaignTable
                        campaigns={data.campaigns}
                        selection={selection}
                        demo={demo}
                        activeOnly={activeOnly}
                      />
                    </section>
                    {!demo && !preview && (data.networkCampaigns.length > 0 || data.networkUnavailable) && <NetworkCampaignResults campaigns={data.networkCampaigns} unavailable={data.networkUnavailable} now={now} />}
                  </>
                ))}
              {selection.view === "inbox" && (
                conversations ? <ConversationInbox key={workspace.clientId} initial={conversations} workspace={workspace} now={now} demo={demo} preview={preview} demoDetails={demoConversations} /> : <>
                  <p className="conversation-fallback" role="status">{conversationError || "Reply access is currently unavailable."} Showing mirrored email history with replies disabled. <a href={workspaceUrl(selection, {}, demo)}>Refresh inbox</a></p>
                  <Inbox data={data} clientId={workspace.clientId} demo={demo} />
                </>
              )}{" "}
              {selection.view === "linkedin" && (preview && conversations ? <><section className="panel preview-channel-summary"><div><span className="eyebrow">SAMPLE LINKEDIN ACTIVITY</span><h2>Conversations creating opportunities</h2><p className="muted">Explore example replies and try a response. Nothing is sent.</p></div><div className="preview-channel-metrics"><span><strong>1,240</strong>Connections</span><span><strong>152</strong>Replies</span><span><strong>12</strong>Meetings</span></div></section><ConversationInbox key={`${workspace.clientId}:linkedin`} now={now} initial={{ conversations: conversations.conversations.filter(item => item.channel === "linkedin"), nextCursor: null }} workspace={workspace} preview demoDetails={demoConversations?.filter(item => item.channel === "linkedin")} initialChannel="linkedin" /></> :
                <LinkedInResults
                  data={data}
                  workspace={workspace}
                  selection={selection}
                  demo={demo}
                  preview={preview}
                  now={now}
                />
              )}
            </>
          )}
        {(selection.view === "overview" || selection.view === "campaigns") && <div className="results-sync-note">{demo || preview ? "Preview · Sample results, not actual campaign performance" : latest ? `Latest email campaign sync ${new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "UTC" }).format(new Date(latest))} UTC` : activeOnly ? "No active campaign sync to display" : "Waiting for the first email campaign sync"}{autoRefresh && " · This page checks for updates every minute."}</div>}
        {selection.view === "linkedin" && autoRefresh && <p className="results-sync-note">This page checks for updates every minute. Each campaign shows its last successful sync.</p>}
      </WorkspaceShell>
    </ReadStateProvider>
  );
}
