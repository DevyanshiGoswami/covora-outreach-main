import "server-only";
import { createClient } from "@/lib/supabase/server";
import { outboundOrigin } from "@/lib/outbound-transport";
import { AccountsServiceError, accountsApiRequest, type AccountsOperation } from "@/lib/accounts-transport";
import { accountsFromResponse } from "@/lib/accounts";

export async function callAccountsApi(operation: AccountsOperation): Promise<unknown> {
  let origin: string;
  try { origin = outboundOrigin(process.env.OUTBOUND_API_ORIGIN, process.env.NODE_ENV === "development"); }
  catch { throw new AccountsServiceError("Outreach inboxes are unavailable. Ask your account manager to configure access."); }
  const client = await createClient();
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) throw new AccountsServiceError("Your session has expired. Sign in again to continue.");
  const { data: { session } } = await client.auth.getSession();
  if (!session?.access_token || session.user.id !== user.id) throw new AccountsServiceError("Your session has expired. Sign in again to continue.");
  return accountsApiRequest(origin, session.access_token, operation);
}
export async function loadAccounts(clientId: string) {
  return accountsFromResponse(await callAccountsApi({ kind: "list", clientId }), clientId);
}
