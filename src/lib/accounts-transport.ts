export class AccountsServiceError extends Error { }
export function accountsErrorMessage(error: unknown): string {
  return error instanceof AccountsServiceError ? error.message : "Outreach inboxes are unavailable. Refresh and try again.";
}
export type AccountsOperation =
  | { kind: "list"; clientId: string }
  | { kind: "register"; body: { clientId: string; email: string; displayName: string } }
  | { kind: "verify"; body: { clientId: string; accountId: string } };
export async function accountsApiRequest(origin: string, token: string, operation: AccountsOperation, fetcher: typeof fetch = fetch): Promise<unknown> {
  let response: Response;
  try {
    const url = new URL(operation.kind === "verify" ? "/api/outbound/accounts/verify" : "/api/outbound/accounts", origin);
    if (operation.kind === "list") url.searchParams.set("clientId", operation.clientId);
    response = await fetcher(url.toString(), {
      method: operation.kind === "list" ? "GET" : "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      ...(operation.kind === "list" ? {} : { body: JSON.stringify(operation.body) }),
      cache: "no-store", credentials: "omit", redirect: "error", signal: AbortSignal.timeout(operation.kind === "verify" ? 40000 : 20000),
    });
  } catch { throw new AccountsServiceError("Inbox access is temporarily unavailable. Please try again."); }
  if (!response.ok) {
    if (response.status === 401) throw new AccountsServiceError("Your session has expired. Sign in again to continue.");
    if (response.status === 403) throw new AccountsServiceError("You no longer have access to manage these inboxes. Refresh your workspace.");
    if (operation.kind === "verify") throw new AccountsServiceError("The connection check could not be completed. Review the latest status before trying again.");
    if (response.status === 400) throw new AccountsServiceError("Check the inbox details and try again.");
    throw new AccountsServiceError("Outreach inboxes could not be saved or loaded. Please try again.");
  }
  try { return await response.json(); }
  catch { throw new AccountsServiceError("The inbox response could not be confirmed. Refresh before trying again."); }
}
