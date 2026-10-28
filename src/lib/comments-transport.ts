import type { CommentFilter, CommentStatus } from "./comments";
export class CommentsServiceError extends Error {}
export function commentsErrorMessage(error: unknown): string { return error instanceof CommentsServiceError ? error.message : "Comments could not be loaded or saved. Please try again."; }
export type CommentsOperation =
  | { kind: "list"; clientId: string; status: CommentFilter; offset: number }
  | { kind: "detail"; clientId: string; requestId: string; offset: number }
  | { kind: "create"; body: { clientId: string; commandId: string; title: string; body: string } }
  | { kind: "reply"; requestId: string; body: { clientId: string; commandId: string; body: string } }
  | { kind: "status"; requestId: string; body: { clientId: string; expectedVersion: number; status: CommentStatus } };
export async function commentsApiRequest(origin: string, token: string, operation: CommentsOperation, fetcher: typeof fetch = fetch): Promise<unknown> {
  let response: Response;
  try {
    const suffix = "requestId" in operation ? `/${encodeURIComponent(operation.requestId)}${operation.kind === "reply" ? "/replies" : ""}` : "";
    const url = new URL(`/api/outbound/comments${suffix}`, origin);
    const reading = operation.kind === "list" || operation.kind === "detail";
    if (reading) { url.searchParams.set("clientId", operation.clientId); url.searchParams.set("offset", String(operation.offset)); if (operation.kind === "list") url.searchParams.set("status", operation.status); }
    response = await fetcher(url.toString(), { method: reading ? "GET" : operation.kind === "status" ? "PATCH" : "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, ...("body" in operation ? { body: JSON.stringify(operation.body) } : {}), cache: "no-store", credentials: "omit", redirect: "error", signal: AbortSignal.timeout(15000) });
  } catch { throw new CommentsServiceError("We could not confirm the request. Your draft is still here. Try again to check and save it."); }
  if (!response.ok) {
    if (response.status === 401) throw new CommentsServiceError("Your session has expired. Sign in again to continue.");
    if (response.status === 403) throw new CommentsServiceError("Comments are not available with your current workspace access.");
    if (response.status === 404) throw new CommentsServiceError("This request is unavailable in this workspace.");
    if (response.status === 409) throw new CommentsServiceError("This request changed. Refresh to review the latest conversation before updating it.");
    if (response.status === 400) throw new CommentsServiceError("Check the title and comment, then try again.");
    throw new CommentsServiceError("Comments are temporarily unavailable. Your draft is still here; please try again.");
  }
  try { return await response.json(); } catch { throw new CommentsServiceError("The request could not be confirmed. Try again to check and save the same draft."); }
}
