import { canUseLiveWorkspace, type OutreachRole, type Workspace } from "./access";

export const ACCOUNT_STATES = ["unverified", "connected", "paused", "maintenance", "setting_up", "needs_attention"] as const;
export type AccountState = (typeof ACCOUNT_STATES)[number];
export type OutreachAccount = {
  id: string;
  client_id: string;
  channel: "email";
  email: string;
  display_name: string;
  state: AccountState;
  last_checked_at: string | null;
  last_attempt_at: string | null;
  check_error: boolean;
  last_connected_at: string | null;
  updated_at: string;
};
export type AccountData = { accounts: OutreachAccount[]; verificationAvailable: boolean };
export type AccountActionState = { error?: string; message?: string };
export const CONNECTION_FRESHNESS_MS = 24 * 60 * 60 * 1000;

const record = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const uuid = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const validDate = (value: unknown): value is string => typeof value === "string" && Number.isFinite(Date.parse(value));
const validEmail = (value: unknown): value is string => typeof value === "string" && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const validName = (value: unknown): value is string => typeof value === "string" && Array.from(value).length <= 100;

export function canManageAccounts(role: OutreachRole | null): boolean {
  return role === "agency_owner" || role === "operator";
}
export function canManageClientAccounts(workspace: Workspace, clientId: string): boolean {
  return canUseLiveWorkspace(workspace, clientId) && canManageAccounts(workspace.role);
}
export function parseAccountRegistration(input: unknown): { clientId: string; email: string; displayName: string } | null {
  const row = record(input);
  const email = typeof row.email === "string" ? row.email.trim().toLowerCase() : row.email;
  const displayName = typeof row.displayName === "string" ? row.displayName.trim() : row.displayName;
  if (!uuid(row.clientId) || !validEmail(email) || !validName(displayName)) return null;
  return { clientId: row.clientId, email, displayName };
}
export function parseAccountCheck(input: unknown): { clientId: string; accountId: string } | null {
  const row = record(input);
  return uuid(row.clientId) && uuid(row.accountId) ? { clientId: row.clientId, accountId: row.accountId } : null;
}
export function registeredAccountFromResponse(input: unknown): string {
  const { accountId } = record(input);
  if (!uuid(accountId)) throw new Error("The inbox registration could not be confirmed.");
  return accountId;
}
export function confirmedAccountCheck(input: unknown): boolean {
  return record(input).ok === true;
}
export function accountsFromResponse(input: unknown, clientId: string): AccountData {
  const row = record(input);
  const fail = (): never => { throw new Error("Outreach inboxes could not be loaded."); };
  if (!uuid(clientId) || !Array.isArray(row.accounts) || typeof row.verificationAvailable !== "boolean") return fail();
  const ids = new Set<string>();
  const accounts = row.accounts.map((value): OutreachAccount => {
    const account = record(value);
    if (!uuid(account.id) || ids.has(account.id) || account.client_id !== clientId || account.channel !== "email" || !validEmail(account.email) || !validName(account.display_name) || !ACCOUNT_STATES.includes(account.state as AccountState) || typeof account.check_error !== "boolean" || (account.last_attempt_at !== null && !validDate(account.last_attempt_at)) || (account.last_checked_at !== null && !validDate(account.last_checked_at)) || (account.last_connected_at !== null && !validDate(account.last_connected_at)) || !validDate(account.updated_at)) return fail();
    ids.add(account.id);
    return { id: account.id, client_id: clientId, channel: "email", email: account.email, display_name: account.display_name, state: account.state as AccountState, last_checked_at: account.last_checked_at, last_attempt_at: account.last_attempt_at, check_error: account.check_error, last_connected_at: account.last_connected_at, updated_at: account.updated_at };
  });
  return { accounts, verificationAvailable: row.verificationAvailable };
}
const observedLabels: Record<AccountState, string> = {
  unverified: "Not verified", connected: "Connected", paused: "Paused", maintenance: "Maintenance", setting_up: "Setting up", needs_attention: "Needs attention",
};
export function accountConnection(account: OutreachAccount, now: number): { label: string; tone: "connected" | "attention" | "neutral"; description: string } {
  if (account.check_error) return { label: "Check unavailable", tone: "attention", description: "The latest attempt could not confirm this inbox’s status." };
  if (!account.last_checked_at) return { label: "Not checked", tone: "neutral", description: "This inbox has no confirmed connection check." };
  const age = now - Date.parse(account.last_checked_at);
  if (!Number.isFinite(age) || age < 0) return { label: "Check needed", tone: "neutral", description: "The recorded check time could not be confirmed." };
  if (age >= CONNECTION_FRESHNESS_MS) return { label: "Check overdue", tone: "attention", description: `Last observed: ${observedLabels[account.state]}. The last check is over 24 hours old.` };
  if (account.state === "connected") {
    const connectedAge = account.last_connected_at ? now - Date.parse(account.last_connected_at) : NaN;
    if (!Number.isFinite(connectedAge) || connectedAge < 0 || connectedAge >= CONNECTION_FRESHNESS_MS) return { label: "Check needed", tone: "neutral", description: "A recent active connection could not be confirmed." };
    return { label: "Connected", tone: "connected", description: "Connection confirmed within the last 24 hours." };
  }
  return {
    label: observedLabels[account.state], tone: account.state === "needs_attention" ? "attention" : "neutral",
    description: account.state === "paused" ? "This inbox is paused."
      : account.state === "maintenance" ? "This inbox is undergoing maintenance."
        : account.state === "setting_up" ? "This inbox is still being set up."
          : account.state === "needs_attention" ? "The last check found an issue that needs review."
            : "A connection has not been confirmed.",
  };
}
