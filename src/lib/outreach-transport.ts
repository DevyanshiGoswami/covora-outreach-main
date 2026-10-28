import type { OutreachInput } from "./outreach";

export class OutreachServiceError extends Error {
  constructor(message: string, public readonly uncertain = false) { super(message); }
}
export type OutreachOperation =
  | { kind: "options"; clientId: string }
  | { kind: "list"; clientId: string }
  | { kind: "start"; body: OutreachInput };

export async function outreachApiRequest(origin: string, token: string, operation: OutreachOperation, fetcher: typeof fetch = fetch): Promise<unknown> {
  const starting = operation.kind === "start";
  const url = new URL(operation.kind === "options" ? "/api/outbound/outreach/options" : "/api/outbound/outreach", origin);
  if (!starting) url.searchParams.set("clientId", operation.clientId);
  let response: Response;
  try {
    response = await fetcher(url.toString(), { method: starting ? "POST" : "GET", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      ...(starting ? { body: JSON.stringify(operation.body) } : {}), cache: "no-store", credentials: "omit", redirect: "error", signal: AbortSignal.timeout(starting ? 65000 : 20000) });
  } catch { throw new OutreachServiceError(starting ? "The outreach outcome is not confirmed. Check its status before starting again." : "Outreach is temporarily unavailable. Please try again.", starting); }
  if (!response.ok) {
    if (response.status === 401) throw new OutreachServiceError("Your session has expired. Sign in again to continue.");
    if (response.status === 403) throw new OutreachServiceError(starting ? "Outreach is not enabled for this account or sender." : "Your outreach access has changed. Refresh this workspace.");
    if (response.status === 400) throw new OutreachServiceError("Check the prospect, sender, subject and message, then try again. A sender can start one outreach at a time.");
    throw new OutreachServiceError(starting ? "The outreach outcome is not confirmed. Check its status before starting again." : "Outreach could not be loaded. Please try again.", starting);
  }
  try { return await response.json(); }
  catch { throw new OutreachServiceError("The response could not be confirmed. Check the outreach status.", starting); }
}
