"use server";
import { revalidatePath } from "next/cache";
import { canUseLiveWorkspace } from "@/lib/access";
import { getWorkspace } from "@/lib/auth";
import { callOnboardingApi, AccountConnectionError, ClientRemovalPendingError, getAgencyAccess, loadPeople } from "@/lib/onboarding-api";
import { canManageConnections, connectionFailureMessage, connectionReviewMessage, connectionReviewRetryAt, connectionChannel, connectionOperation, connectionState, connectionNextStep, emailConsentUrl, type OnboardingActionState } from "@/lib/onboarding";
import { isUuid, isInvitationToken } from "@/lib/team";
import { LinkedInSessionInputError, sessionConnectionFields } from "@/lib/linkedin-session";
import { linkedinCodeSubmission } from "@/lib/linkedin-verification";
const failure = { error: "We could not confirm this change. Refresh to check its status before trying again." };
function refresh() { for (const path of ["/settings", "/agency", "/agency/setup"]) revalidatePath(path); }
async function authorize(clientId: string, owner = false) {
  if (!isUuid(clientId)) return false;
  const workspace = await getWorkspace(clientId);
  return canManageConnections(workspace, clientId) && (!owner || workspace.role === "agency_owner");
}
export async function addPerson(_previous: OnboardingActionState, form: FormData): Promise<OnboardingActionState> {
  const clientId = String(form.get("clientId") ?? "");
  if (!await authorize(clientId)) return { error: "Your role does not allow account changes in this workspace." };
  try {
    await callOnboardingApi("people", { clientId, name: String(form.get("name") ?? "").trim(), email: String(form.get("email") ?? "").trim() });
    refresh(); return { message: "Person added. Connect at least one account to complete setup." };
  } catch { return failure; }
}
export async function createClientWorkspace(_previous: OnboardingActionState, form: FormData): Promise<OnboardingActionState> {
  if (!(await getAgencyAccess()).canManageClients) return { error: "Your account does not have permission to add clients." };
  try {
    await callOnboardingApi("clients", { id: String(form.get("id") ?? ""), name: String(form.get("name") ?? "").trim() });
    refresh(); return { message: "Client added. Invite their administrator and connect their accounts." };
  } catch { return failure; }
}
export async function removeClientWorkspace(_previous: OnboardingActionState, form: FormData): Promise<OnboardingActionState> {
  const clientId = String(form.get("clientId") ?? "");
  const name = String(form.get("name") ?? "");
  if (!isUuid(clientId) || !(await getAgencyAccess()).canManageClients) return { error: "Your account does not have permission to remove clients." };
  if (!name || name.length > 200) return { error: "Enter the client name to confirm removal." };
  try {
    await callOnboardingApi("clients/remove", { clientId, name });
    revalidatePath("/", "layout");
    return { message: "Client removed from the portal. Its history has been retained." };
  } catch (error) {
    if (error instanceof ClientRemovalPendingError) return { error: "A reply is being sent. Wait a minute, refresh, and try again." };
    return { error: "Removal could not be confirmed. Check the client name and refresh the client list before retrying." };
  }
}
export async function inviteClientAdministrator(_previous: OnboardingActionState, form: FormData): Promise<OnboardingActionState> {
  const clientId = String(form.get("clientId") ?? "");
  if (!await authorize(clientId, true)) return { error: "Only an agency owner can manage this workspace connection or invitation." };
  try {
    const result = await callOnboardingApi("invitations", { clientId, email: String(form.get("email") ?? "").trim() });
    if (!isInvitationToken(result.token) || (result.loginToken !== null && (typeof result.loginToken !== "string" || !/^[a-zA-Z0-9_-]{20,256}$/.test(result.loginToken)))) throw new Error();
    return { token: result.token, loginToken: result.loginToken ?? undefined, message: result.loginToken ? "Share this private invitation with the client administrator. They can create their password and accept access." : "Share this invitation with the client administrator. They must sign in with their existing account; contact Covora if they need login access." };
  } catch { return failure; }
}
export async function bindManagedConnection(_previous: OnboardingActionState, form: FormData): Promise<OnboardingActionState> {
  const clientId = String(form.get("clientId") ?? "");
  if (!await authorize(clientId, true)) return { error: "Only an agency owner can manage this workspace connection or invitation." };
  try {
    await callOnboardingApi("integrations", { clientId, optionId: String(form.get("optionId") ?? "") });
    refresh(); return { message: "Workspace connection authenticated. People can now connect their accounts." };
  } catch { return { error: "Workspace authentication could not be confirmed. Ask your deployment administrator to check the connection configuration." }; }
}
export async function connectPerson(_previous: OnboardingActionState, form: FormData): Promise<OnboardingActionState> {
  const clientId = String(form.get("clientId") ?? "");
  if (!isUuid(clientId) || !canUseLiveWorkspace(await getWorkspace(clientId), clientId)) return { error: "Your role does not allow account changes in this workspace." };
  try {
    const personId = String(form.get("personId") ?? "");
    if (!isUuid(personId)) throw new Error();
    const person = (await loadPeople(clientId)).find(person => person.id === personId && person.canConnect);
    if (!person) throw new Error();
    const channel = connectionChannel(form.get("channel"));
    const previousState = person.connections.find(connection => connection.channel === channel)?.state;
    const { action, provider, method } = connectionOperation(form.get("operation"), channel);
    const body: Record<string, unknown> = { personId, channel, action, ...(provider ? { provider } : {}) };
    if ((action === "start" || action === "switch") && channel === "email") body.email = String(form.get("email") ?? "").trim();
    if (action === "start" && channel === "linkedin") Object.assign(body, {
      email: form.get("email"), country: String(form.get("country") ?? "").trim().toUpperCase(),
      ...(method === "cookies" ? sessionConnectionFields(form) : { password: form.get("password") }),
    });
    if (action === "pin") body.pin = form.get("pin");
    const result = await callOnboardingApi("connections", body);
    const connection = { state: connectionState(result.state), authUrl: emailConsentUrl(result.authUrl),
      nextStep: channel === "linkedin" && result.state === "pending" ? connectionNextStep(result.nextStep) : undefined };
    // Skip revalidation for unchanged in-progress reads. Always refresh a final
    // result, which another tab may have saved since this dialog was opened.
    if (connection.state !== previousState || !["pending", "starting"].includes(connection.state)) refresh();
    if (action === "review") {
      if (result.reviewStatus === "unavailable") return { connection, error: result.failureCode === "service_unavailable"
        ? connectionReviewMessage(result.reviewStatus, channel) : connectionFailureMessage(result.failureCode) ?? connectionReviewMessage(result.reviewStatus, channel) };
      return { connection, message: connectionReviewMessage(result.reviewStatus, channel), retryAt: connectionReviewRetryAt(result.reviewStatus, result.expiresAt) };
    }
    return { connection, ...(action === "pin" ? { codeSubmission: linkedinCodeSubmission(result) } : {}),
      retryAt: (connection.state === "pending" || connection.state === "starting")
        ? connectionReviewRetryAt("waiting", result.expiresAt) : undefined,
      error: connectionFailureMessage(result.failureCode) ?? (connection.state === "failed" ? "The account connection failed. Ask your agency owner to verify the client’s connection settings before retrying." : undefined) };
  } catch (error) { return error instanceof AccountConnectionError || error instanceof LinkedInSessionInputError ? { error: error.message } : failure; }
}

export async function disconnectPerson(_previous: OnboardingActionState, form: FormData): Promise<OnboardingActionState> {
  const clientId = String(form.get("clientId") ?? "");
  if (!isUuid(clientId) || !canUseLiveWorkspace(await getWorkspace(clientId), clientId)) return { error: "Your role does not allow account changes in this workspace." };
  try {
    const connectionId = String(form.get("connectionId") ?? "");
    const action = String(form.get("operation") ?? "");
    if (!isUuid(connectionId) || !["disconnect", "check-disconnect"].includes(action)) throw new Error();
    const connection = (await loadPeople(clientId)).flatMap(person => person.connections).find(item => item.id === connectionId && item.canDisconnect);
    if (!connection) return { error: "Your access or this account’s status changed. Refresh the page before continuing." };
    const result = await callOnboardingApi("connections", { connectionId, action });
    const state = connectionState(result.state);
    refresh();
    return { connection: { state, authUrl: null }, ...(state === "disconnected" ? { message: "Account disconnected. You can connect an account again when ready." }
      : { error: connectionFailureMessage(result.failureCode) ?? "Disconnection is still being checked. Please check again shortly." }) };
  } catch (error) { refresh(); return error instanceof AccountConnectionError ? { error: error.message } : failure; }
}

/** Explicitly end the exact unfinished sign-in shown to this person. */
export async function cancelLinkedinSignIn(_previous: OnboardingActionState, form: FormData): Promise<OnboardingActionState> {
  const clientId = String(form.get("clientId") ?? "");
  if (!isUuid(clientId) || !canUseLiveWorkspace(await getWorkspace(clientId), clientId)) return { error: "Your role does not allow account changes in this workspace." };
  try {
    const personId = String(form.get("personId") ?? ""), connectionId = String(form.get("connectionId") ?? "");
    const operation = String(form.get("operation") ?? "");
    if (!isUuid(personId) || !isUuid(connectionId) || !["cancel", "check-cancel"].includes(operation)) throw new Error();
    const person = (await loadPeople(clientId)).find(item => item.id === personId && item.canConnect);
    const connection = person?.connections.find(item => item.id === connectionId && item.channel === "linkedin" && (item.canCancel || item.state === "disconnected"));
    if (!connection) return { error: "This sign-in changed. Refresh Accounts before switching." };
    const result = await callOnboardingApi("connections", { connectionId, action: operation === "cancel" ? "cancel" : "check-disconnect" });
    const state = connectionState(result.state);
    refresh();
    return { connection: { state, authUrl: null }, ...(state === "disconnected"
      ? { message: "Previous sign-in ended. Enter the LinkedIn account you want to use." }
      : { error: connectionFailureMessage(result.failureCode) ?? "The previous sign-in is still being checked. Check cancellation again before using another account." }) };
  } catch (error) { refresh(); return error instanceof AccountConnectionError ? { error: error.message } : failure; }
}
