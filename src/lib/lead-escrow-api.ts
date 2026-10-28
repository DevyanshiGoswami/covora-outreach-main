import "server-only";
import type { Workspace } from "./access";
import { createClient } from "./supabase/server";
import { outboundOrigin } from "./outbound-transport";
import { LeadDirectoryServiceError } from "./leads-transport";
import { canReadEscrow, escrowFromResponse, type EscrowQuery } from "./lead-escrow";
import { escrowApiRequest } from "./lead-escrow-transport";

export async function loadEscrow(workspace: Workspace, query: EscrowQuery) {
  const clientId = workspace.clientId;
  if (!clientId || !canReadEscrow(workspace, clientId)) throw new LeadDirectoryServiceError("Escrow requires agency access to this company.");
  let origin: string;
  try { origin = outboundOrigin(process.env.OUTBOUND_API_ORIGIN, process.env.NODE_ENV === "development"); }
  catch { throw new LeadDirectoryServiceError("Escrow access is not configured for this workspace."); }
  const db = await createClient();
  const { data: { user }, error } = await db.auth.getUser();
  if (error || !user) throw new LeadDirectoryServiceError("Your session has expired. Sign in again to view escrow.");
  const { data: { session } } = await db.auth.getSession();
  if (!session?.access_token || session.user.id !== user.id) throw new LeadDirectoryServiceError("Your session has expired. Sign in again to view escrow.");
  return escrowFromResponse(await escrowApiRequest(origin, session.access_token, clientId, query), clientId);
}
