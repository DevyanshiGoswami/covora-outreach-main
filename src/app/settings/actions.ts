"use server";

import { revalidatePath } from "next/cache";
import { getWorkspace } from "@/lib/auth";
import { canRequestSetup, canManageSetup, canUseLiveWorkspace } from "@/lib/access";
import { callSetupApi, loadSetupRequests } from "@/lib/outbound-api";
import { parseSetupRequest, parseSetupUpdate, allowedSetupStatuses, type SetupActionState } from "@/lib/setup";
import { setupErrorMessage } from "@/lib/outbound-transport";

function refreshSetup() {
  revalidatePath("/settings");
  revalidatePath("/agency/setup");
}
export async function requestSetup(_previous: SetupActionState, form: FormData): Promise<SetupActionState> {
  const input = parseSetupRequest(Object.fromEntries(form));
  if (!input) return { error: "Choose a valid account type and try again." };
  const workspace = await getWorkspace(input.clientId);
  if (!canUseLiveWorkspace(workspace, input.clientId) || !canRequestSetup(workspace.role)) return { error: "You do not have permission to request setup for this workspace." };
  try {
    const result = await callSetupApi({ method: "POST", body: input });
    if (!result || typeof result !== "object" || !("requestId" in result) || typeof result.requestId !== "string") return { error: "Setup could not be confirmed. Refresh to check your requests before trying again." };
    refreshSetup();
    return { message: "Your setup request is with Covora. We’ll share progress and next steps here." };
  } catch (error) { return { error: setupErrorMessage(error) }; }
}
export async function updateSetup(_previous: SetupActionState, form: FormData): Promise<SetupActionState> {
  const input = parseSetupUpdate(Object.fromEntries(form));
  if (!input) return { error: "Choose a valid status and keep the client-visible note within 1,000 characters." };
  const workspace = await getWorkspace(input.clientId, true);
  if (!canUseLiveWorkspace(workspace, input.clientId) || !canManageSetup(workspace.role)) return { error: "You do not have permission to update this workspace's requests." };
  try {
    const requests = await loadSetupRequests(input.clientId);
    const request = requests.find((item) => item.id === input.requestId);
    if (!request) return { error: "This request is no longer available in the selected workspace. Refresh to continue." };
    if (!allowedSetupStatuses(request.status).includes(input.status)) return { error: "This request changed. Refresh to choose an available status." };
    const result = await callSetupApi({ method: "PATCH", body: { requestId: input.requestId, status: input.status, note: input.note } });
    if (!result || typeof result !== "object" || !("ok" in result) || result.ok !== true) return { error: "Your update could not be confirmed. Refresh to check the request." };
    refreshSetup();
    return { message: "Request updated. The client can see this status and note." };
  } catch (error) { return { error: setupErrorMessage(error) }; }
}
