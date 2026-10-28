import "server-only";
import { createClient } from "@/lib/supabase/server";
import { outboundOrigin } from "@/lib/outbound-transport";
import { TeamServiceError, teamApiRequest, type TeamOperation } from "@/lib/team-transport";
import { teamFromResponse } from "@/lib/team";
export async function callTeamApi(operation: TeamOperation): Promise<unknown> {
  let origin: string;
  try { origin = outboundOrigin(process.env.OUTBOUND_API_ORIGIN, process.env.NODE_ENV === "development"); }
  catch { throw new TeamServiceError("Team access is unavailable. Ask your account manager to configure access.", "not_configured"); }
  const client = await createClient();
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) throw new TeamServiceError("Your session has expired. Sign in again to continue.", "session_expired");
  const { data: { session } } = await client.auth.getSession();
  if (!session?.access_token || session.user.id !== user.id) throw new TeamServiceError("Your session has expired. Sign in again to continue.", "session_expired");
  return teamApiRequest(origin, session.access_token, operation);
}
export async function loadTeam(clientId: string) { return teamFromResponse(await callTeamApi({ kind: "list", clientId }), clientId); }
