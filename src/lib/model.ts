export type Campaign = {
  id: string;
  client_id: string;
  name: string;
  status: string;
  totals: Record<string, number>;
  analyticsAvailable?: boolean;
  synced_at: string | null;
  schedule: {
    start_date?: string;
    end_date?: string;
    windows?: { timezone: string; from: string; to: string; days: number[] }[];
  };
};
export type Daily = {
  campaign_id: string;
  day: string;
  sent: number;
  contacted: number;
  new_contacted: number;
  unique_replies: number;
  auto_replies: number;
  opportunities: number;
};
export type Step = {
  campaign_id: string;
  step: number;
  variant: number;
  subject: string;
  body_text: string;
  delay_days: number;
  stats: Record<string, number>;
};
export type Lead = {
  id: string;
  campaign_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  company: string | null;
  status: string;
  last_step: number | null;
  reply_count: number;
  interest: number | null;
  last_activity_at: string | null;
};
export type Message = {
  id: string;
  campaign_id: string;
  thread_key: string;
  direction: string;
  lead_email: string;
  from_email: string;
  to_email: string;
  subject: string;
  body_text: string;
  sent_at: string;
  interest: number | null;
  is_auto_reply: boolean;
  client_read_at: string | null;
};
export type LinkedInDay = {
  client_id: string;
  day: string;
  source: string;
  sent: number;
  replied: number | null;
  meeting_booked: number | null;
};
export type NetworkCampaign = {
  id: string;
  client_id: string;
  name: string;
  status: string;
  totals: {
    leads: number | null;
    invitations_sent: number | null;
    invitations_accepted: number | null;
    messages_sent: number | null;
    replies: number | null;
  };
  synced_at: string | null;
  schedule: Campaign["schedule"];
};
export type ResultsData = {
  campaigns: Campaign[];
  daily: Daily[];
  steps: Step[];
  leads: Lead[];
  messages: Message[];
  linkedin: LinkedInDay[];
  networkCampaigns: NetworkCampaign[];
  networkUnavailable?: boolean;
  unread: number;
  truncated: boolean;
};
export type WorkspaceInfo = import("./access").Workspace;
export type View = "overview" | "campaigns" | "inbox" | "linkedin";
export type DetailTab = "analytics" | "leads" | "sequence" | "schedule";
export type DateRange = "7d" | "30d" | "all";
export type Selection = {
  view: View;
  campaign: string;
  tab: DetailTab;
  range: DateRange;
  client: string;
};
export function parseSelection(
  params: Record<string, string | string[] | undefined>,
): Selection {
  const one = (key: string) =>
    typeof params[key] === "string" ? (params[key] as string) : "";
  return {
    view: ["campaigns", "inbox", "linkedin"].includes(one("view"))
      ? (one("view") as View)
      : "overview",
    campaign: one("campaign"),
    client: one("client"),
    tab: ["leads", "sequence", "schedule"].includes(one("tab"))
      ? (one("tab") as DetailTab)
      : "analytics",
    range: ["7d", "all"].includes(one("range"))
      ? (one("range") as DateRange)
      : "30d",
  };
}
export const EMPTY_DATA: ResultsData = {
  campaigns: [],
  daily: [],
  steps: [],
  leads: [],
  messages: [],
  linkedin: [],
  networkCampaigns: [],
  unread: 0,
  truncated: false,
};
