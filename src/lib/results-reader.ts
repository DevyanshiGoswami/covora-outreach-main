import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { activeCampaignResults } from "./workspace-results-policy";
import type { Campaign, ResultsData, Selection, WorkspaceInfo } from "./model";
import { EMPTY_DATA } from "./model";
import { count, INTEREST_LABELS, isCalendarDay, rangeStart } from "./metrics";
import { analyticsAvailability } from "./results-availability";
import { clientCampaignName } from "./client-copy";
import { networkTotals, networkCampaignName } from "./network-results";

const PAGE_SIZE = 500;
const MAX_ROWS = 10000;
type Result<T> = { data: T[] | null; error: unknown };
async function pages<T>(
  query: (start: number, end: number) => PromiseLike<Result<T>>,
) {
  const rows: T[] = [];
  for (let start = 0; start < MAX_ROWS; start += PAGE_SIZE) {
    const result = await Promise.resolve(
      query(start, start + PAGE_SIZE - 1),
    ).catch(() => {
      throw new Error("Results could not be loaded.");
    });
    if (result.error) throw new Error("Results could not be loaded.");
    const page = result.data || [];
    rows.push(...page);
    if (page.length < PAGE_SIZE) return { rows, truncated: false };
  }
  return { rows, truncated: true };
}
function numericRecord(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, v]) => typeof v === "number")
      .map(([k, v]) => [k, count(v)]),
  );
}
function schedule(value: unknown): Campaign["schedule"] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const row = value as Record<string, unknown>;
  const windows = Array.isArray(row.windows)
    ? row.windows.flatMap((w) => {
        if (!w || typeof w !== "object") return [];
        const v = w as Record<string, unknown>;
        if (
          typeof v.timezone !== "string" ||
          typeof v.from !== "string" ||
          typeof v.to !== "string" ||
          !Array.isArray(v.days)
        )
          return [];
        return [
          {
            timezone: v.timezone,
            from: v.from,
            to: v.to,
            days: v.days.filter(
              (d): d is number =>
                typeof d === "number" &&
                Number.isInteger(d) &&
                d >= 0 &&
                d <= 6,
            ),
          },
        ];
      })
    : [];
  return {
    start_date: isCalendarDay(row.start_date) ? row.start_date : undefined,
    end_date: isCalendarDay(row.end_date) ? row.end_date : undefined,
    windows,
  };
}
const interestCode = (label: string | null): number | null => {
  const match = Object.entries(INTEREST_LABELS).find(
    ([, name]) => name === label,
  );
  return match ? Number(match[0]) : null;
};

/** Authorization context is verified before every call. All result reads retain
 * explicit client scope in addition to the database's tenant and feature gates. */
export async function readResults(
  db: SupabaseClient<Database>,
  workspace: WorkspaceInfo,
  selection: Selection,
): Promise<ResultsData> {
  if (!workspace.enabled || !workspace.clientId) return { ...EMPTY_DATA };
  const clientId = workspace.clientId;
  const activeOnly = activeCampaignResults(clientId, selection.view);
  const today = new Date().toISOString().slice(0, 10);
  const firstDay = rangeStart(selection.range, today);
  const [campaignResult, unreadResult] = await Promise.all([
    pages((start, end) => {
      let query = db
        .from("client_outreach_campaigns")
        .select("id,client_id,name,status,totals,schedule,synced_at")
        .eq("client_id", clientId);
      if (activeOnly) query = query.eq("status", "active");
      return query
        .order("created_at", { ascending: false })
        .order("id")
        .range(start, end);
    }),
    db
      .from("client_outreach_messages")
      .select("id", { head: true, count: "exact" })
      .eq("client_id", clientId)
      .eq("direction", "received")
      .is("client_read_at", null),
  ]);
  if (unreadResult.error) throw new Error("Results could not be loaded.");
  const campaigns: Campaign[] = campaignResult.rows
    .filter((c) => c.id)
    .map((c) => ({
      id: c.id!,
      client_id: clientId,
      name: clientCampaignName(c.name),
      status: c.status || "unknown",
      totals: numericRecord(c.totals),
      analyticsAvailable: analyticsAvailability(c.totals),
      schedule: schedule(c.schedule),
      synced_at: c.synced_at,
    }));
  const data: ResultsData = {
    ...EMPTY_DATA,
    campaigns,
    unread: unreadResult.count || 0,
    truncated: campaignResult.truncated,
  };
  const selected = campaigns.find((c) => c.id === selection.campaign);
  const detail = selection.view === "campaigns" && selected;
  const tasks: Promise<void>[] = [];
  if (selection.view === "overview" || selection.view === "linkedin" || (selection.view === "campaigns" && !selection.campaign))
    tasks.push((async () => {
      try {
        const result = await pages((start, end) => db
          .from("client_outreach_network_campaigns")
          .select("id,client_id,name,status,totals,schedule,synced_at")
          .eq("client_id", clientId)
          .order("id")
          .range(start, end));
        data.networkCampaigns = result.rows.filter((row) => row.id && row.client_id === clientId).map((row) => ({
          id: row.id!, client_id: clientId, name: networkCampaignName(row.name),
          status: row.status || "unknown", totals: networkTotals(row.totals),
          synced_at: row.synced_at, schedule: schedule(row.schedule),
        }));
        data.truncated ||= result.truncated;
      } catch {
        data.networkUnavailable = true;
      }
    })());
  if (
    (selection.view === "overview" || (detail && selection.tab === "analytics")) &&
    (!activeOnly || campaigns.length > 0)
  )
    tasks.push(
      (async () => {
        const result = await pages((start, end) => {
          let query = db
            .from("client_outreach_campaign_daily")
            .select(
              "campaign_id,day,sent,contacted,new_contacted,unique_replies,auto_replies,opportunities",
            )
            .eq("client_id", clientId)
            .lte("day", today);
          if (firstDay) query = query.gte("day", firstDay);
          if (detail) query = query.eq("campaign_id", selected.id);
          else if (activeOnly) query = query.in("campaign_id", campaigns.map((campaign) => campaign.id));
          return query
            .order("day", { ascending: false })
            .order("campaign_id")
            .range(start, end);
        });
        data.daily = result.rows
          .filter((r) => r.campaign_id && isCalendarDay(r.day))
          .map((r) => ({
            campaign_id: r.campaign_id!,
            day: r.day!,
            sent: count(r.sent),
            contacted: count(r.contacted),
            new_contacted: count(r.new_contacted),
            unique_replies: count(r.unique_replies),
            auto_replies: count(r.auto_replies),
            opportunities: count(r.opportunities),
          }));
        data.truncated ||= result.truncated;
      })(),
    );
  if (detail && ["analytics", "sequence"].includes(selection.tab))
    tasks.push(
      (async () => {
        const result = await pages((start, end) =>
          db
            .from("client_outreach_campaign_steps")
            .select(
              "campaign_id,step,variant,subject,body_text,delay_days,stats",
            )
            .eq("client_id", clientId)
            .eq("campaign_id", selected.id)
            .order("step")
            .order("variant")
            .range(start, end),
        );
        data.steps = result.rows
          .filter((r) => r.campaign_id && r.step !== null && r.variant !== null)
          .map((r) => ({
            campaign_id: r.campaign_id!,
            step: count(r.step),
            variant: count(r.variant),
            subject: r.subject || "",
            body_text: r.body_text || "",
            delay_days: count(r.delay_days),
            stats: numericRecord(r.stats),
          }));
        data.truncated ||= result.truncated;
      })(),
    );
  if (selection.view === "inbox" || (detail && selection.tab === "leads"))
    tasks.push(
      (async () => {
        const result = await pages((start, end) => {
          let query = db
            .from("client_outreach_leads")
            .select(
              "id,campaign_id,email,first_name,last_name,company,status,last_step,reply_count,interest,last_activity_at",
            )
            .eq("client_id", clientId);
          if (detail) query = query.eq("campaign_id", selected.id);
          return query
            .order("last_activity_at", { ascending: false, nullsFirst: false })
            .order("id")
            .range(start, end);
        });
        data.leads = result.rows
          .filter((r) => r.id && r.campaign_id)
          .map((r) => ({
            id: r.id!,
            campaign_id: r.campaign_id!,
            email: r.email || "",
            first_name: r.first_name,
            last_name: r.last_name,
            company: r.company,
            status: r.status || "unknown",
            last_step: r.last_step,
            reply_count: count(r.reply_count),
            interest: interestCode(r.interest),
            last_activity_at: r.last_activity_at,
          }));
        data.truncated ||= result.truncated;
      })(),
    );
  if (selection.view === "inbox")
    tasks.push(
      (async () => {
        const result = await pages((start, end) =>
          db
            .from("client_outreach_messages")
            .select(
              "id,campaign_id,thread_key,direction,lead_email,from_email,to_email,subject,body_text,sent_at,interest,is_auto_reply,client_read_at",
            )
            .eq("client_id", clientId)
            .order("sent_at", { ascending: false })
            .order("id")
            .range(start, end),
        );
        data.messages = result.rows
          .filter(
            (r) =>
              r.id &&
              r.campaign_id &&
              r.thread_key &&
              r.sent_at &&
              (r.direction === "received" || r.direction === "sent"),
          )
          .map((r) => ({
            id: r.id!,
            campaign_id: r.campaign_id!,
            thread_key: r.thread_key!,
            direction: r.direction!,
            lead_email: r.lead_email || "",
            from_email: r.from_email || "",
            to_email: r.to_email || "",
            subject: r.subject || "",
            body_text: r.body_text || "",
            sent_at: r.sent_at!,
            interest: interestCode(r.interest),
            is_auto_reply: r.is_auto_reply === true,
            client_read_at: r.client_read_at,
          }));
        data.truncated ||= result.truncated;
      })(),
    );
  if (selection.view === "linkedin")
    tasks.push(
      (async () => {
        const result = await pages((start, end) => {
          let query = db
            .from("client_outreach_linkedin_daily")
            .select("client_id,day,source,sent,replied,meeting_booked")
            .eq("client_id", clientId)
            .lte("day", today);
          if (firstDay) query = query.gte("day", firstDay);
          return query
            .order("day", { ascending: false })
            .order("source")
            .range(start, end);
        });
        data.linkedin = result.rows
          .filter((r) => isCalendarDay(r.day) && r.source)
          .map((r) => ({
            client_id: clientId,
            day: r.day!,
            source: r.source!,
            sent: count(r.sent),
            replied: r.replied,
            meeting_booked: r.meeting_booked,
          }));
        data.truncated ||= result.truncated;
      })(),
    );
  await Promise.all(tasks);
  return data;
}
