import type { LeadDirectoryQuery } from "./verified-leads";

export class LeadDirectoryServiceError extends Error {}

/** The server owns the endpoint and bearer. Filter text is never executable query syntax. */
export async function leadDirectoryApiRequest(
  origin: string,
  token: string,
  clientId: string,
  query: LeadDirectoryQuery,
  fetcher: typeof fetch = fetch,
): Promise<unknown> {
  const url = new URL("/api/outbound/leads", origin);
  url.searchParams.set("clientId", clientId);
  for (const key of ["q", "role", "company", "campaign", "list", "email", "linkedin", "status", "sort", "page", "audience", "city", "state"] as const) {
    if (query[key] !== "") url.searchParams.set(key, String(query[key]));
  }
  let response: Response;
  try {
    response = await fetcher(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store", credentials: "omit", redirect: "error",
      signal: AbortSignal.timeout(20000),
    });
  } catch {
    throw new LeadDirectoryServiceError("Your leads are temporarily unavailable. Please try again.");
  }
  if (!response.ok) {
    if (response.status === 401) throw new LeadDirectoryServiceError("Your session has expired. Sign in again to view your leads.");
    if (response.status === 403) throw new LeadDirectoryServiceError("You no longer have access to these leads. Refresh your workspace.");
    if (response.status === 400) throw new LeadDirectoryServiceError("These lead filters could not be applied. Clear the filters and try again.");
    throw new LeadDirectoryServiceError("Your leads could not be loaded. Please try again.");
  }
  try { return await response.json(); }
  catch { throw new LeadDirectoryServiceError("Your lead data could not be confirmed. Please try again."); }
}
