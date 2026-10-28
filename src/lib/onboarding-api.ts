import "server-only";
import { createClient } from "./supabase/server";
import { outboundOrigin } from "./outbound-transport";
import { agencyAccess } from "./agency-permissions";
import { integrationErrorFromResponse } from './admin-integrations';
import { connectionFailureMessage, connectionRequestMessage, record, managedConnectionsFromResponse, peopleFromResponse, type OnboardingData } from "./onboarding";
type Endpoint = "context" | "clients" | "clients/remove" | "people" | "integrations" | "invitations" | "connections" | "admin-integrations";
export class ClientRemovalPendingError extends Error {}
export class AccountConnectionError extends Error {
  constructor(status: number, failureCode?: unknown) { super(status === 400 ? connectionFailureMessage(failureCode) ?? connectionRequestMessage(status) : connectionRequestMessage(status)); }
}
export async function callOnboardingApi(endpoint: Endpoint, body?: Record<string, unknown>, clientId?: string): Promise<Record<string, unknown>> {
  const origin = outboundOrigin(process.env.OUTBOUND_API_ORIGIN, process.env.NODE_ENV === "development");
  const client = await createClient();
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) throw new Error("Session required");
  const { data: { session } } = await client.auth.getSession();
  if (!session?.access_token || session.user.id !== user.id) throw new Error("Session required");
  const url = new URL(`/api/onboarding/${endpoint}`, origin);
  if (clientId) url.searchParams.set("clientId", clientId);
  const response = await fetch(url, { method: body ? "POST" : "GET", headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}), cache: "no-store", redirect: "error", signal: AbortSignal.timeout(30000) });
  if (!response.ok) {
    if (endpoint === "connections") {
      const body: unknown = await response.json().catch(() => null);
      throw new AccountConnectionError(response.status, body && typeof body === "object" && "failureCode" in body ? body.failureCode : undefined);
    }
    if (endpoint === 'clients/remove' && response.status === 409) throw new ClientRemovalPendingError();
    if (endpoint === 'admin-integrations') {
      const error = integrationErrorFromResponse(await response.json().catch(() => null));
      if (error) throw error;
    }
    throw new Error("Onboarding request unavailable");
  }
  return record(await response.json());
}
export async function isOnboardingOwner(): Promise<boolean> {
  return (await getAgencyAccess()).isOwner;
}
export async function getAgencyAccess() {
  try { return agencyAccess(await callOnboardingApi("context")); }
  catch { return { isOwner: false, canManageClients: false }; }
}
export async function loadPeople(clientId: string) { return peopleFromResponse(await callOnboardingApi("people", undefined, clientId)); }
export async function loadOnboarding(clientId: string): Promise<OnboardingData> {
  try {
    const [people, response] = await Promise.all([loadPeople(clientId), callOnboardingApi("integrations", undefined, clientId)]);
    const integrations = managedConnectionsFromResponse(response);
    return { people, integrations };
  } catch { return { people: [], integrations: { status: { email: false, linkedin: false }, options: [] }, error: "Account connections could not be loaded. Reload this page to try again." }; }
}
