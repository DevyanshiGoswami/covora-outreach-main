export class SetupServiceError extends Error {}
export function setupErrorMessage(error: unknown): string {
  return error instanceof SetupServiceError ? error.message : "Setup is unavailable. Please refresh and try again.";
}
export function outboundOrigin(value: string | undefined, development: boolean): string {
  try {
    const url = new URL(value || "");
    const loopback = development && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if ((url.protocol !== "https:" && !(loopback && url.protocol === "http:")) || url.username || url.password || url.pathname !== "/" || url.search || url.hash) throw new SetupServiceError();
    return url.origin;
  } catch { throw new SetupServiceError("Account setup is unavailable. Ask your account manager to configure setup access."); }
}
type SetupOperation = { method: "GET"; clientId: string } | { method: "POST" | "PATCH"; body: Record<string, string> };
export async function setupApiRequest(origin: string, token: string, operation: SetupOperation, fetcher: typeof fetch = fetch): Promise<unknown> {
  let response: Response;
  try {
    const url = new URL("/api/outbound/setup", origin);
    if (operation.method === "GET") url.searchParams.set("clientId", operation.clientId);
    response = await fetcher(url.toString(), {
      method: operation.method,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      ...(operation.method === "GET" ? {} : { body: JSON.stringify(operation.body) }),
      cache: "no-store", credentials: "omit", redirect: "error", signal: AbortSignal.timeout(15000),
    });
  } catch { throw new SetupServiceError("Setup service is unavailable. Please try again shortly."); }
  if (!response.ok) {
    if (response.status === 401) throw new SetupServiceError("Your session has expired. Sign in again to continue.");
    if (response.status === 403) throw new SetupServiceError("You no longer have permission for this setup request. Refresh your workspace.");
    throw new SetupServiceError("Setup could not be saved or loaded. Please try again.");
  }
  try { return await response.json(); }
  catch { throw new SetupServiceError("Setup service returned an incomplete response. Please try again."); }
}
