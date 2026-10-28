"use server";

import { canUseLiveWorkspace } from "@/lib/access";
import { getWorkspace } from "@/lib/auth";
import { unstable_rethrow } from "next/navigation";
import { callConversationsApi } from "@/lib/conversations-api";
import { canReplyInWorkspace, conversationsFromResponse, detailFromResponse, replyFromResponse, validConversationSelection, validOwnerInput, validReplyInput, type ConversationFilter } from "@/lib/conversations";
import { ConversationServiceError, conversationError } from "@/lib/conversations-transport";
const denied = "You do not have access to this conversation.";
async function authorize(clientId: string, writing = false) {
  const workspace = await getWorkspace(clientId);
  if (!canUseLiveWorkspace(workspace, clientId) || writing && !canReplyInWorkspace(workspace, clientId)) throw new ConversationServiceError(denied);
  return workspace;
}
export async function listConversations(clientId: string, channel: ConversationFilter, cursor?: string) {
  try {
    if (!validConversationSelection(clientId) || !["all", "email", "linkedin"].includes(channel) || cursor !== undefined && (typeof cursor !== "string" || !cursor || cursor.length > 1024)) return { error: denied };
    await authorize(clientId);
    return { data: conversationsFromResponse(await callConversationsApi({ kind: "list", clientId, channel, cursor }), clientId, channel) };
  } catch (error) { unstable_rethrow(error); return { error: conversationError(error) }; }
}
export async function getConversation(clientId: string, conversationId: string) {
  try {
    if (!validConversationSelection(clientId, conversationId)) return { error: denied };
    await authorize(clientId);
    return { data: detailFromResponse(await callConversationsApi({ kind: "detail", clientId, conversationId }), clientId, conversationId) };
  } catch (error) { unstable_rethrow(error); return { error: conversationError(error) }; }
}
export async function readConversation(clientId: string, conversationId: string) {
  try {
    if (!validConversationSelection(clientId, conversationId)) return { error: denied };
    await authorize(clientId);
    const response = await callConversationsApi({ kind: "read", conversationId, body: { clientId } });
    if (!response || typeof response !== "object" || !("ok" in response) || response.ok !== true) throw new Error();
    return { ok: true };
  } catch (error) { unstable_rethrow(error); return { error: conversationError(error) }; }
}
export async function changeConversationOwner(conversationId: string, raw: unknown) {
  try {
    const input = validOwnerInput(raw);
    if (!input || !validConversationSelection(input.clientId, conversationId)) return { error: denied };
    const workspace = await authorize(input.clientId, true);
    const current = detailFromResponse(await callConversationsApi({ kind: "detail", clientId: input.clientId, conversationId }), input.clientId, conversationId);
    if (!current.canTakeover || input.owner === "covora" && !current.ownedByMe && workspace.role !== "agency_owner") return { error: denied };
    return { data: detailFromResponse(await callConversationsApi({ kind: "owner", conversationId, body: input }), input.clientId, conversationId) };
  } catch (error) { unstable_rethrow(error); return { error: conversationError(error) }; }
}
export async function sendConversationReply(conversationId: string, raw: unknown) {
  let dispatched = false;
  try {
    const input = validReplyInput(raw);
    if (!input || !validConversationSelection(input.clientId, conversationId)) return { error: "Write a reply within 4,000 characters and the message size limit.", uncertain: false };
    await authorize(input.clientId, true);
    // The backend atomically checks owner, version, latest message and command replay before dispatch.
    dispatched = true;
    const response = await callConversationsApi({ kind: "reply", conversationId, body: input });
    return { data: replyFromResponse(response, input.clientId, conversationId, input) };
  } catch (error) {
    unstable_rethrow(error);
    return { error: conversationError(error), uncertain: error instanceof ConversationServiceError ? error.uncertain : dispatched };
  }
}
