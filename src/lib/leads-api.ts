import "server-only";
import { verifiedRequestAuth } from "./verified-request-auth";
import { outboundOrigin } from "./outbound-transport";
import { LeadDirectoryServiceError, leadDirectoryApiRequest } from "./leads-transport";
import { leadDirectoryFromResponse, type LeadDirectoryQuery } from "./verified-leads";

export async function loadLeadDirectory(clientId: string, query: LeadDirectoryQuery) {
  let origin: string;
  try { origin = outboundOrigin(process.env.OUTBOUND_API_ORIGIN, process.env.NODE_ENV === "development"); }
  catch { throw new LeadDirectoryServiceError("Lead access is not configured for this workspace."); }
  const { client: db, user, error } = await verifiedRequestAuth();
  if (error || !user) throw new LeadDirectoryServiceError("Your session has expired. Sign in again to view your leads.");
  const { data: { session } } = await db.auth.getSession();
  if (!session?.access_token || session.user.id !== user.id) throw new LeadDirectoryServiceError("Your session has expired. Sign in again to view your leads.");
  return leadDirectoryFromResponse(await leadDirectoryApiRequest(origin, session.access_token, clientId, query), clientId);
}
