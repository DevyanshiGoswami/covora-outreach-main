"use server";

import { revalidatePath } from "next/cache";
import { getWorkspace } from "@/lib/auth";
import { callAccountsApi, loadAccounts } from "@/lib/accounts-api";
import { canManageClientAccounts, confirmedAccountCheck, parseAccountCheck, parseAccountRegistration, registeredAccountFromResponse, type AccountActionState } from "@/lib/accounts";
import { accountsErrorMessage } from "@/lib/accounts-transport";

const denied = { error: "You do not have permission to manage inboxes for this workspace." };
function refreshAccounts() {
  revalidatePath("/settings");
  revalidatePath("/agency/setup");
}
export async function registerAccount(_previous: AccountActionState, form: FormData): Promise<AccountActionState> {
  const input = parseAccountRegistration(Object.fromEntries(form));
  if (!input) return { error: "Enter an existing email address and keep the display name within 100 characters." };
  const workspace = await getWorkspace(input.clientId, true);
  if (!canManageClientAccounts(workspace, input.clientId)) return denied;
  try {
    const data = await loadAccounts(input.clientId);
    if (!data.verificationAvailable) return { error: "Configure this workspace before registering an inbox." };
    registeredAccountFromResponse(await callAccountsApi({ kind: "register", body: input }));
    refreshAccounts();
    return { message: "Inbox registered. Check its connection to confirm the current status. No mailbox was created." };
  } catch (error) { return { error: accountsErrorMessage(error) }; }
}
export async function checkAccountConnection(_previous: AccountActionState, form: FormData): Promise<AccountActionState> {
  const input = parseAccountCheck(Object.fromEntries(form));
  if (!input) return denied;
  const workspace = await getWorkspace(input.clientId, true);
  if (!canManageClientAccounts(workspace, input.clientId)) return denied;
  try {
    const data = await loadAccounts(input.clientId);
    if (!data.accounts.some((account) => account.id === input.accountId)) return { error: "This inbox is no longer available in this workspace. Refresh to continue." };
    if (!data.verificationAvailable) return { error: "Connection checks are not available for this workspace yet." };
    const result = await callAccountsApi({ kind: "verify", body: input });
    if (!confirmedAccountCheck(result)) return { error: "The check could not be confirmed. Review the latest inbox status." };
    return { message: "Connection check complete. Review the latest status." };
  } catch (error) { return { error: accountsErrorMessage(error) }; }
  finally { refreshAccounts(); }
}
