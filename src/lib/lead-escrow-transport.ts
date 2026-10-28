import type { EscrowQuery } from "./lead-escrow";
import { LeadDirectoryServiceError } from "./leads-transport";

export async function escrowApiRequest(origin: string, token: string, clientId: string, query: EscrowQuery, fetcher: typeof fetch = fetch): Promise<unknown> {
  const url = new URL("/api/outbound/leads/escrow", origin);
  url.searchParams.set("clientId", clientId);
  if (query.q) url.searchParams.set("q", query.q);
  url.searchParams.set("page", String(query.page));
  let response: Response;
  try {
    response = await fetcher(url, { method: "GET", headers: { Authorization: `Bearer ${token}` }, cache: "no-store", credentials: "omit", redirect: "error", signal: AbortSignal.timeout(20000) });
  } catch { throw new LeadDirectoryServiceError("The escrow list is temporarily unavailable. Please try again."); }
  if (!response.ok) {
    if (response.status === 401) throw new LeadDirectoryServiceError("Your session has expired. Sign in again to view escrow.");
    if (response.status === 403) throw new LeadDirectoryServiceError("You no longer have access to this escrow list. Refresh your workspace.");
    throw new LeadDirectoryServiceError("The escrow list could not be loaded. Please try again.");
  }
  try { return await response.json(); }
  catch { throw new LeadDirectoryServiceError("The escrow list could not be confirmed. Please try again."); }
}
