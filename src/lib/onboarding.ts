import { isUuid, TEAM_ROLES, MEMBER_STATES, type TeamRole, type MemberState } from "./team";
import { canRequestSetup, canUseLiveWorkspace, type Workspace } from "./access";
import { clientOperationalNote } from './client-copy';
import type { CodeSubmission } from "./linkedin-verification";
export type ConnectionChannel = "email" | "linkedin";
export const CONNECTION_LABELS = { starting: "Connecting…", pending: "Finish sign-in", connected: "Connected", failed: "Couldn’t connect", expired: "Try again", uncertain: "Check needed", needs_review: "Check needed", disconnecting: "Disconnecting…", disconnect_uncertain: "Check disconnection", disconnected: "Not connected" } as const;
export type ConnectionState = keyof typeof CONNECTION_LABELS;
export type PersonConnection = { id: string; channel: ConnectionChannel; state: ConnectionState; canContinue: boolean; canDisconnect?: boolean; canCancel?: boolean; loginEmail?: string; address?: string; updatedAt: string };
export type OutreachPerson = { id: string; name: string; email: string; source: "team" | "external"; isSelf: boolean; canConnect: boolean; role: TeamRole | null; access: MemberState | null; connections: PersonConnection[] };
export type WorkspaceAssignment = { optionId: string | null; label: string; enabled: boolean };
export type ManagedConnections = { status: Record<ConnectionChannel, boolean>; assignments?: Record<ConnectionChannel, WorkspaceAssignment | null>; options: { id: string; label: string; channel: ConnectionChannel; keyConfigured: boolean }[] };
export type OnboardingData = { people: OutreachPerson[]; integrations: ManagedConnections; error?: string };
export type ConnectionNextStep = "connecting" | "verification_code" | "syncing" | "check_status";
export function connectionNextStep(value: unknown): ConnectionNextStep | undefined {
  return typeof value === "string" && ["connecting", "verification_code", "syncing", "check_status"].includes(value) ? value as ConnectionNextStep : undefined;
}
export type ConnectionResult = { state: ConnectionState; authUrl: string | null; nextStep?: ConnectionNextStep };
export type OnboardingActionState = { error?: string; message?: string; token?: string; loginToken?: string; connection?: ConnectionResult; retryAt?: string; codeSubmission?: CodeSubmission };
export function connectionReviewRetryAt(status: unknown, expiresAt: unknown): string | undefined {
  if (status !== "waiting" || typeof expiresAt !== "string" || !/^\d{4}-\d{2}-\d{2}T/.test(expiresAt)) return undefined;
  const date = new Date(expiresAt);
  return Number.isFinite(date.getTime()) ? date.toISOString() : undefined;
}
export function connectionReviewMessage(value: unknown, channel: ConnectionChannel = "email"): string {
  if (channel === "linkedin") switch (value) {
    case "restored": return "We found your LinkedIn sign-in. We’re checking its status now.";
    case "missing": return "The previous attempt has ended. Connect LinkedIn again below.";
    case "waiting": return "We couldn’t find this LinkedIn sign-in yet. Check again after the time below.";
    case "checking": return "A connection check or sign-in is already in progress. Please check again shortly.";
    default: return "We couldn’t get the latest LinkedIn status. Check again shortly. You can return to Accounts while this is unresolved.";
  }
  switch (value) {
    case "connected": return "Email connection confirmed. Your setup is complete.";
    case "missing": return "The previous attempt has ended. Choose your provider below to connect this email again.";
    case "waiting": return "The mailbox isn’t connected yet. If a sign-in window is open, finish it. Otherwise, check again after the time below.";
    case "checking": return "A connection check or sign-in is already in progress. Please check again shortly.";
    default: return "We could not verify the mailbox yet. Check again later, or ask your agency owner to review this client’s connection settings.";
  }
}
export function canManageConnections(workspace: Workspace, clientId: string) { return canUseLiveWorkspace(workspace, clientId) && canRequestSetup(workspace.role); }
export function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid response");
  return value as Record<string, unknown>;
}
export function connectionState(value: unknown): ConnectionState {
  if (typeof value !== "string" || !Object.hasOwn(CONNECTION_LABELS, value)) throw new Error("Invalid response");
  return value as ConnectionState;
}
export function connectionChannel(value: unknown): ConnectionChannel {
  if (value !== "email" && value !== "linkedin") throw new Error("Invalid response");
  return value;
}
export function managedConnectionsFromResponse(value: unknown): ManagedConnections {
  const response = record(value); const status = record(response.status);
  const optionId = (value: unknown): value is string => typeof value === 'string' && /^[a-z0-9-]{1,60}$/.test(value);
  if (typeof status.email !== 'boolean' || typeof status.linkedin !== 'boolean' || !Array.isArray(response.options)) throw new Error('Invalid response');
  const result: ManagedConnections = { status: { email: status.email, linkedin: status.linkedin }, options: response.options.map(value => {
    const option = record(value);
    if (!optionId(option.id) || typeof option.label !== 'string' || typeof option.keyConfigured !== 'boolean') throw new Error('Invalid response');
    return { id: option.id, label: clientOperationalNote(option.label, 'Managed connection'), channel: connectionChannel(option.channel), keyConfigured: option.keyConfigured };
  }) };
  if (response.assignments !== undefined) {
    const assignments = record(response.assignments);
    const parse = (channel: ConnectionChannel): WorkspaceAssignment | null => {
      if (assignments[channel] === null) return null;
      const row = record(assignments[channel]);
      if ((row.optionId !== null && !optionId(row.optionId)) || typeof row.label !== 'string' || typeof row.enabled !== 'boolean') throw new Error('Invalid response');
      if (row.optionId !== null && !result.options.some(option => option.id === row.optionId && option.channel === channel)) throw new Error('Invalid assignment');
      return { optionId: row.optionId, label: clientOperationalNote(row.label, 'Managed connection'), enabled: row.enabled };
    };
    result.assignments = { email: parse('email'), linkedin: parse('linkedin') };
  }
  return result;
}
export function peopleFromResponse(value: unknown): OutreachPerson[] {
  const people = record(value).people;
  if (!Array.isArray(people)) throw new Error("Invalid response");
  return people.map(value => {
    const p = record(value);
    if (!isUuid(p.id) || typeof p.name !== "string" || typeof p.email !== "string" || !Array.isArray(p.connections)) throw new Error("Invalid response");
    if (!["team", "external"].includes(String(p.source)) || typeof p.isSelf !== "boolean" || typeof p.canConnect !== "boolean" || (p.role !== null && !TEAM_ROLES.includes(p.role as TeamRole)) || (p.access !== null && !MEMBER_STATES.includes(p.access as MemberState))) throw new Error("Invalid response");
    return { id: p.id, name: p.name, email: p.email, source: p.source as OutreachPerson["source"], isSelf: p.isSelf, canConnect: p.canConnect, role: p.role as TeamRole | null, access: p.access as MemberState | null, connections: p.connections.map(value => {
      const c = record(value);
      if (!isUuid(c.id) || typeof c.canContinue !== "boolean" || typeof c.updatedAt !== "string" || !Number.isFinite(Date.parse(c.updatedAt))) throw new Error("Invalid response");
      if (c.canDisconnect !== undefined && typeof c.canDisconnect !== "boolean") throw new Error("Invalid response");
      if (c.canCancel !== undefined && typeof c.canCancel !== "boolean") throw new Error("Invalid response");
      if (c.loginEmail != null && typeof c.loginEmail !== "string") throw new Error("Invalid response");
      if (c.address !== undefined && typeof c.address !== "string") throw new Error("Invalid response");
      return { canCancel: c.canCancel === true, loginEmail: typeof c.loginEmail === "string" ? c.loginEmail : undefined, canDisconnect: c.canDisconnect === true, address: c.address as string | undefined, id: c.id, channel: connectionChannel(c.channel), state: connectionState(c.state), canContinue: c.canContinue, updatedAt: c.updatedAt };
    }) };
  });
}
export function googleConsentUrl(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value !== "string") throw new Error("Invalid response");
  const url = new URL(value);
  if (url.origin !== "https://accounts.google.com" || url.username || url.password || !["/o/oauth2/auth", "/o/oauth2/v2/auth"].includes(url.pathname) || !url.searchParams.get("state")) throw new Error("Invalid response");
  return url.href;
}
const MICROSOFT_ORIGIN = "https://login.microsoftonline.com";
function microsoftConsentUrl(value: string): string {
  const url = new URL(value);
  if (url.origin !== MICROSOFT_ORIGIN || url.username || url.password || !/^\/[A-Za-z0-9.-]+\/oauth2\/(v2\.0\/)?authorize$/.test(url.pathname) || !url.searchParams.get("state")) throw new Error("Invalid response");
  return url.href;
}
/** Only Google or Microsoft sign-in pages with state are ever opened or linked. */
export function emailConsentUrl(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value !== "string") throw new Error("Invalid response");
  return new URL(value).origin === MICROSOFT_ORIGIN ? microsoftConsentUrl(value) : googleConsentUrl(value);
}
export function consentProviderName(url: string): "Google" | "Microsoft" {
  return new URL(url).origin === MICROSOFT_ORIGIN ? "Microsoft" : "Google";
}
export type EmailProvider = "google" | "microsoft";
export type EmailProviderChoice = EmailProvider | "personal" | "other";
export const EMAIL_PROVIDERS: { value: EmailProviderChoice; label: string; description: string }[] = [
  { value: "google", label: "Google", description: "Personal Gmail or company email hosted by Google" },
  { value: "microsoft", label: "Microsoft", description: "Microsoft 365, Outlook or Hotmail" },
  { value: "other", label: "Another provider", description: "An email service other than Google or Microsoft" },
];
export function isPersonalGmail(email: string): boolean { return /@(gmail|googlemail)\.com$/i.test(email.trim()); }
export function canStartEmailConnection(provider: EmailProviderChoice | null, _email: string): provider is EmailProvider {
  return provider === "google" || provider === "microsoft";
}
export type ConnectionOperation = { action: "start" | "switch" | "poll" | "pin" | "review"; provider?: EmailProvider; method?: "cookies" };
/** Email start buttons name their provider ("start-google", "start-microsoft"); a bare "start" keeps the service default. */
export function connectionOperation(operation: unknown, channel: ConnectionChannel): ConnectionOperation {
  if (channel === "linkedin" && operation === "start-cookies") return { action: "start", method: "cookies" };
  if (channel === "email" && (operation === "start-google" || operation === "start-microsoft")) return { action: "start", provider: operation === "start-google" ? "google" : "microsoft" };
  // Ends an open sign-in (unless it already finished) and starts the chosen provider instead.
  if (channel === "email" && (operation === "switch-google" || operation === "switch-microsoft")) return { action: "switch", provider: operation === "switch-google" ? "google" : "microsoft" };
  if (!["start", "poll", "pin", "review"].includes(String(operation)) || (operation === "pin" && channel !== "linkedin")) throw new Error("Invalid operation");
  return { action: operation as ConnectionOperation["action"] };
}

const connectionFailures: Record<string, string> = {
  linkedin_disconnected: "LinkedIn sign-in ended without connecting. Check your sign-in details or choose another connection method below.",
  linkedin_status_unavailable: "We couldn’t get the latest LinkedIn status. Check again shortly. You can return to Accounts while this is unresolved.",
  linkedin_code_not_requested: "A verification code is not currently requested. Check connection status to see the next step.",
  linkedin_code_rejected: "The code was not accepted. Check the latest LinkedIn code and try again, or check connection status.",
  linkedin_check_in_progress: "A connection check is still running. Your code was not submitted. Wait a moment, then enter the latest code and submit again.",
  disconnect_campaigns: "This account is assigned to a campaign. Ask your agency owner to remove its campaign assignments before disconnecting.",
  disconnect_pending_reply: "A reply is pending for this account. Wait for it to finish, then try again. If its status is unknown, ask your agency owner to review it.",
  disconnect_identity_mismatch: "The account assignment could not be verified. Ask your agency owner to review it before disconnecting.",
  disconnect_managed_account: "This mailbox is managed by the email service. Ask your agency owner to review it there before removing it.",
  disconnect_access_denied: "The service does not allow this removal or its required account checks. Ask your agency owner to review the connection permissions in Integrations.",
  disconnect_not_confirmed: "We haven’t confirmed the disconnection. Check its status before reconnecting. If it remains unresolved, ask your agency owner to review it.",
  connection_retry_later: "Too many recent attempts. Wait one minute, then try again.",
  linkedin_cancel_unavailable: "The previous sign-in could not be ended yet. Check its status first. If it connected, disconnect it from Accounts before switching.",
  linkedin_identity_locked: "The previous LinkedIn sign-in has not ended yet. Choose Use another account to end it, or Check previous sign-in to continue it.",
  connection_identity_reserved: "This login email is already reserved for another person. Ask your agency owner to review the account assignment.",
  linkedin_profile_mismatch: "This browser session belongs to a different LinkedIn profile. Check your profile URL and export the session from the correct account.",
  linkedin_access_denied: "Your agency’s LinkedIn connection cannot sign in to accounts. Ask your agency owner to check the connection and account-login API access.",
  linkedin_no_free_seat: "Your agency’s LinkedIn workspace has no free sender seat. Ask your agency owner to free or add a seat in the LinkedIn service, then try again.",
  linkedin_session_rejected: "This LinkedIn session was rejected. Sign into LinkedIn again in Chrome, export a fresh session, and try again.",
  linkedin_location_unavailable: "We couldn’t set up the LinkedIn connection for this country. Check that the country code matches where you are connecting from. If it is correct, ask your agency owner to review the connection location settings.",
  linkedin_request_rejected: "The LinkedIn connection request was rejected. Check your sign-in details and country. If they are correct, ask your agency owner to review this connection.",
  personal_gmail_unsupported: "Personal Gmail needs a separate app-password setup, which is not available here yet. Ask your agency owner for help, or connect LinkedIn below.",
  account_already_assigned: "This mailbox is already assigned to another email workspace. Ask your agency owner to review its assignment before trying again.",
  consent_denied: "Sign-in was cancelled or permission was denied. Try again and review the requested permissions. If your company blocks access, ask your company administrator for approval.",
  sign_in_rejected: "The email provider did not complete sign-in. Check the account and any company approval shown in the sign-in window, then try again.",
  account_create_required: "Sign-in cannot start because your agency’s email connection is missing permission to add accounts. Ask your agency owner to update the connection in Integrations.",
  account_read_required: "Your agency’s email connection cannot check account status. Ask your agency owner to update its permissions in Integrations.",
  key_rejected: "Your agency’s email connection was rejected. Ask your agency owner to verify the API key and client assignment in Integrations.",
  access_denied: "Your agency’s email connection does not have the access needed for this step. Ask your agency owner to review its permissions.",
  rate_limited: "Too many connection attempts. Wait a minute before trying again.",
  workspace_mismatch: "The email connection is assigned to a different workspace. Ask your agency owner to correct this client’s connection settings.",
  mailbox_mismatch: "The account you signed in with did not match this person’s email address. Sign in with the email shown above.",
  account_not_ready: "The mailbox could not be confirmed as ready in this workspace. Ask your agency owner to review its setup.",
  service_unavailable: "We could not confirm the connection with the email service. Refresh to check its status before trying again.",
};
export function connectionFailureMessage(code: unknown): string | undefined {
  if (code === undefined || code === null) return undefined;
  return typeof code === "string" && Object.hasOwn(connectionFailures, code)
    ? connectionFailures[code] : "The account connection could not be confirmed. Ask your agency owner to review its setup.";
}

export function connectionRequestMessage(status: number): string {
  if (status === 400) return "Check the connection details and try again. If it keeps failing, ask your agency owner to review the account and client connection settings.";
  if (status === 401) return "Your Covora session expired. Sign in again before connecting your account.";
  if (status === 403) return "Your access or this connection’s assignment changed. Reload the page and try again from your own account.";
  return "We could not confirm this change. Refresh to check its status before trying again.";
}

/** Actions come from server permissions, separately for connecting and removing. */
export function personChannelAction(person: OutreachPerson, channel: ConnectionChannel): { kind: "connect" | "disconnect" | "check-disconnect"; label: string } | null {
  const connection = person.connections.find(item => item.channel === channel);
  if (channel === "linkedin" && connection?.canCancel && ["disconnecting", "disconnect_uncertain"].includes(connection.state)) return { kind: "connect", label: "Check cancellation" };
  if (connection?.state === "disconnecting" || connection?.state === "disconnect_uncertain")
    return connection.canDisconnect ? { kind: "check-disconnect", label: "Check disconnection" } : null;
  if (connection?.state === "connected") return connection.canDisconnect ? { kind: "disconnect", label: "Disconnect" } : null;
  if (!person.canConnect) return null;
  return { kind: "connect", label: connection && ["starting", "pending"].includes(connection.state) ? "Continue sign-in"
    : connection && ["uncertain", "needs_review"].includes(connection.state) ? "Check connection" : channel === "email" ? "Connect email" : "Connect LinkedIn" };
}
