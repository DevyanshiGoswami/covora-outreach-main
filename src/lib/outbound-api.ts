import "server-only";
import { createClient } from "@/lib/supabase/server";
import { outboundOrigin, setupApiRequest, SetupServiceError } from "@/lib/outbound-transport";
import { setupRequestsFromResponse } from "@/lib/setup";

export async function callSetupApi(operation: Parameters<typeof setupApiRequest>[2]): Promise<unknown> {
  const origin = outboundOrigin(process.env.OUTBOUND_API_ORIGIN, process.env.NODE_ENV === "development");
  const client = await createClient();
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) throw new SetupServiceError("Your session has expired. Sign in again to continue.");
  const { data: { session } } = await client.auth.getSession();
  if (!session?.access_token || session.user.id !== user.id) throw new SetupServiceError("Your session has expired. Sign in again to continue.");
  return setupApiRequest(origin, session.access_token, operation);
}
export async function loadSetupRequests(clientId: string) {
  return setupRequestsFromResponse(await callSetupApi({ method: "GET", clientId }), clientId);
}
