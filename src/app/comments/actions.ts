"use server";
import { revalidatePath } from "next/cache";
import { getWorkspace } from "@/lib/auth";
import { callCommentsApi } from "@/lib/comments-api";
import { commentsErrorMessage } from "@/lib/comments-transport";
import { canComment, canManageComments, commentsAccess, parseCommentInput, parseCommentStatus, type CommentActionState } from "@/lib/comments";
import { isUuid } from "@/lib/team";

async function saveComment(form: FormData, kind: "create" | "reply"): Promise<CommentActionState> {
  const input = parseCommentInput(Object.fromEntries(form), kind);
  if (!input) return { error: "Add a title of up to 120 characters and a comment of up to 5,000 characters." };
  const workspace = await getWorkspace(input.clientId);
  if (!commentsAccess(workspace, input.clientId) || !canComment(workspace.role)) return { error: "You do not have permission to add comments in this workspace." };
  try {
    const result = await callCommentsApi(kind === "create"
      ? { kind: "create", body: { clientId: input.clientId, commandId: input.commandId, title: input.title, body: input.body } }
      : { kind: "reply", requestId: input.requestId!, body: { clientId: input.clientId, commandId: input.commandId, body: input.body } });
    if (!result || typeof result !== "object" || !("requestId" in result) || !isUuid(result.requestId) || (kind === "reply" && result.requestId !== input.requestId)) throw new Error();
    revalidatePath("/comments");
    return { requestId: result.requestId };
  } catch (error) { return { error: commentsErrorMessage(error) }; }
}
export async function createComment(form: FormData): Promise<CommentActionState> { return saveComment(form, "create"); }
export async function replyToComment(form: FormData): Promise<CommentActionState> { return saveComment(form, "reply"); }
export async function updateCommentStatus(form: FormData): Promise<CommentActionState> {
  const input = parseCommentStatus(Object.fromEntries(form));
  if (!input) return { error: "Refresh the request and choose a valid status." };
  const workspace = await getWorkspace(input.clientId);
  if (!commentsAccess(workspace, input.clientId) || !canManageComments(workspace.role)) return { error: "Only your Covora team can update request statuses." };
  try {
    const result = await callCommentsApi({ kind: "status", requestId: input.requestId, body: { clientId: input.clientId, expectedVersion: input.expectedVersion, status: input.status } });
    if (!result || typeof result !== "object" || !("ok" in result) || result.ok !== true) throw new Error();
    revalidatePath("/comments"); return { ok: true };
  } catch (error) { return { error: commentsErrorMessage(error) }; }
}
