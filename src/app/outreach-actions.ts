"use server";

import { unstable_rethrow } from "next/navigation";
import { canUseLiveWorkspace } from "@/lib/access";
import { getWorkspace } from "@/lib/auth";
import { canReplyInWorkspace, validConversationSelection } from "@/lib/conversations";
import { callOutreachApi, OutreachServiceError } from "@/lib/outreach-api";
import { outreachFromResponse, outreachListFromResponse, outreachOptionsFromResponse, validOutreachInput } from "@/lib/outreach";

const denied = "You do not have access to outreach in this workspace.";
const message = (error: unknown) => error instanceof OutreachServiceError ? error.message : "Outreach could not be verified. Refresh to try again.";
async function authorize(clientId: string) {
  const workspace = await getWorkspace(clientId);
  if (!canUseLiveWorkspace(workspace, clientId) || !canReplyInWorkspace(workspace, clientId)) throw new OutreachServiceError(denied);
}

export async function getOutreachOptions(clientId: string) {
  try {
    if (!validConversationSelection(clientId)) return { error: denied };
    await authorize(clientId);
    return { data: outreachOptionsFromResponse(await callOutreachApi({ kind: "options", clientId })) };
  } catch (error) { unstable_rethrow(error); return { error: message(error) }; }
}

export async function listOutreach(clientId: string) {
  try {
    if (!validConversationSelection(clientId)) return { error: denied };
    await authorize(clientId);
    return { data: outreachListFromResponse(await callOutreachApi({ kind: "list", clientId }), clientId) };
  } catch (error) { unstable_rethrow(error); return { error: message(error) }; }
}

/** One durable send ID per attempt; an unconfirmed outcome is never retried automatically. */
export async function startOutreach(raw: unknown) {
  let dispatched = false;
  try {
    const input = validOutreachInput(raw);
    if (!input) return { error: "Enter a valid recipient email, choose a sender, and write a subject and a message within 4,000 characters.", uncertain: false };
    await authorize(input.clientId);
    dispatched = true;
    return { data: outreachFromResponse(await callOutreachApi({ kind: "start", body: input }), input.clientId, input.sendId) };
  } catch (error) {
    unstable_rethrow(error);
    return { error: message(error), uncertain: error instanceof OutreachServiceError ? error.uncertain : dispatched };
  }
}
