import type { SupabaseClient } from "@supabase/supabase-js";
import { agencyWorkspaces, type Workspace, type WorkspaceChoice } from "./access";
import type { Database } from "./database.types";

export type AgencyPortfolioClient = WorkspaceChoice & {
  activeCampaigns: number | null;
  receivedEmails: number | null;
  oldestCampaignSync: string | null;
  unavailable: boolean;
};

/** Keep the read boundary scoped even when a caller supplies mixed memberships. */
export function authorizedAgencyClients(workspace: Workspace): WorkspaceChoice[] {
  if (!workspace.enabled) return [];
  return agencyWorkspaces(workspace.clients);
}

const exactCount = (value: number | null): number | null =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;

/** Reads only membership-authorized aggregate data through the current user's RLS session. */
export async function readAgencyPortfolio(
  db: SupabaseClient<Database>,
  workspace: Workspace,
  options: { includeMetrics?: boolean } = {},
): Promise<AgencyPortfolioClient[]> {
  const clients = authorizedAgencyClients(workspace);
  const output: AgencyPortfolioClient[] = [];
  // Keep a large agency from creating an unbounded burst of requests.
  for (let index = 0; index < clients.length; index += 4) {
    const batch = await Promise.all(clients.slice(index, index + 4).map(async (client) => {
      const base: AgencyPortfolioClient = {
        ...client, activeCampaigns: null, receivedEmails: null,
        oldestCampaignSync: null, unavailable: false,
      };
      // Preview activity is intentionally never mixed into operational metrics.
      if (options.includeMetrics === false || client.presentationMode === "preview") return base;
      const [campaigns, replies, freshness] = await Promise.allSettled([
        db.from("client_outreach_campaigns").select("id", { count: "exact", head: true })
          .eq("client_id", client.id).eq("status", "active"),
        db.from("client_outreach_messages").select("id", { count: "exact", head: true })
          .eq("client_id", client.id).eq("direction", "received"),
        db.from("client_outreach_campaigns").select("synced_at")
          .eq("client_id", client.id).eq("status", "active")
          .order("synced_at", { ascending: true, nullsFirst: true }).limit(1),
      ]);
      const campaignsOk = campaigns.status === "fulfilled" && !campaigns.value.error;
      const repliesOk = replies.status === "fulfilled" && !replies.value.error;
      const freshnessOk = freshness.status === "fulfilled" && !freshness.value.error;
      const activeCampaigns = campaignsOk ? exactCount(campaigns.value.count) : null;
      const receivedEmails = repliesOk ? exactCount(replies.value.count) : null;
      const synced = freshnessOk ? freshness.value.data?.[0]?.synced_at : null;
      const oldestCampaignSync = typeof synced === "string" && Number.isFinite(Date.parse(synced)) && Date.parse(synced) <= Date.now()
        ? synced : null;
      return {
        ...base, activeCampaigns, receivedEmails, oldestCampaignSync,
        unavailable: activeCampaigns === null || receivedEmails === null || !freshnessOk,
      };
    }));
    output.push(...batch);
  }
  return output;
}
