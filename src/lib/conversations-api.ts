import "server-only";
import { createClient } from "@/lib/supabase/server";
import { outboundOrigin } from "./outbound-transport";
import { ConversationServiceError, conversationsApiRequest, type ConversationOperation } from "./conversations-transport";
import { conversationsFromResponse } from "./conversations";
export async function callConversationsApi(operation: ConversationOperation): Promise<unknown> {
  let origin: string;
  try { origin = outboundOrigin(process.env.OUTBOUND_API_ORIGIN, process.env.NODE_ENV === "development"); }
  catch { throw new ConversationServiceError("Reply access is not configured for this workspace."); }
  const client = await createClient();
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) throw new ConversationServiceError("Your session has expired. Sign in again to continue.");
  const { data: { session } } = await client.auth.getSession();
  if (!session?.access_token || session.user.id !== user.id) throw new ConversationServiceError("Your session has expired. Sign in again to continue.");
  return conversationsApiRequest(origin, session.access_token, operation);
}
export async function loadConversations(clientId: string) {
  return conversationsFromResponse(await callConversationsApi({ kind: "list", clientId, channel: "all" }), clientId, "all");
}
