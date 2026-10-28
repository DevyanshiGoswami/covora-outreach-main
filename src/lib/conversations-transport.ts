import type { ConversationFilter, OwnerInput, ReplyInput } from "./conversations";
export class ConversationServiceError extends Error {
  constructor(message: string, public readonly uncertain = false) { super(message); }
}
export type ConversationOperation =
  | { kind: "list"; clientId: string; channel: ConversationFilter; cursor?: string }
  | { kind: "detail"; clientId: string; conversationId: string }
  | { kind: "read"; conversationId: string; body: { clientId: string } }
  | { kind: "owner"; conversationId: string; body: OwnerInput }
  | { kind: "reply"; conversationId: string; body: ReplyInput };
export async function conversationsApiRequest(origin: string, token: string, operation: ConversationOperation, fetcher: typeof fetch = fetch): Promise<unknown> {
  const reading = operation.kind === "list" || operation.kind === "detail";
  const path = operation.kind === "list" ? "/api/outbound/conversations" : `/api/outbound/conversations/${encodeURIComponent(operation.conversationId)}${reading ? "" : `/${operation.kind}`}`;
  const url = new URL(path, origin);
  if (reading) url.searchParams.set("clientId", operation.clientId);
  if (operation.kind === "list") { url.searchParams.set("channel", operation.channel); if (operation.cursor) url.searchParams.set("cursor", operation.cursor); }
  let response: Response;
  try {
    response = await fetcher(url.toString(), { method: reading ? "GET" : "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, ...("body" in operation ? { body: JSON.stringify(operation.body) } : {}), cache: "no-store", credentials: "omit", redirect: "error", signal: AbortSignal.timeout(operation.kind === "reply" ? 65000 : 20000) });
  } catch { throw new ConversationServiceError(operation.kind === "reply" ? "The reply outcome is not confirmed. Refresh its status before sending again." : "Conversations are temporarily unavailable. Please try again.", operation.kind === "reply"); }
  if (!response.ok) {
    if (response.status === 401) throw new ConversationServiceError("Your session has expired. Sign in again to continue.");
    if (response.status === 403) throw new ConversationServiceError("Your conversation access has changed. Refresh this workspace.");
    if (response.status === 409) throw new ConversationServiceError("This conversation changed. Refresh it before trying again.");
    if (response.status === 400) throw new ConversationServiceError("Check your reply and refresh the conversation before trying again.");
    throw new ConversationServiceError(operation.kind === "reply" ? "The reply outcome is not confirmed. Refresh its status before sending again." : "Conversations could not be loaded or updated. Please try again.", operation.kind === "reply");
  }
  try { return await response.json(); }
  catch { throw new ConversationServiceError("The response could not be confirmed. Refresh the conversation.", operation.kind === "reply"); }
}
export const conversationError = (error: unknown) => error instanceof ConversationServiceError ? error.message : "The conversation could not be verified. Refresh to try again.";
