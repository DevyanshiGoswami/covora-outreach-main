import type { AccountData } from "./accounts";
import type { SetupRequest } from "./setup";
import { accountsErrorMessage } from "./accounts-transport";
import { setupErrorMessage } from "./outbound-transport";

export type SettingsData = { now: number; requests: SetupRequest[]; error?: string; accountData: AccountData | null; accountsError?: string };
/** An unavailable list must not erase the independently available account or request workflow. */
export async function loadSettingsData(clientId: string, loaders: {
  requests: (clientId: string) => Promise<SetupRequest[]>;
  accounts: (clientId: string) => Promise<AccountData>;
}): Promise<SettingsData> {
  const [requests, accounts] = await Promise.allSettled([loaders.requests(clientId), loaders.accounts(clientId)]);
  return {
    now: Date.now(),
    requests: requests.status === "fulfilled" ? requests.value : [],
    ...(requests.status === "rejected" ? { error: setupErrorMessage(requests.reason) } : {}),
    accountData: accounts.status === "fulfilled" ? accounts.value : null,
    ...(accounts.status === "rejected" ? { accountsError: accountsErrorMessage(accounts.reason) } : {}),
  };
}
