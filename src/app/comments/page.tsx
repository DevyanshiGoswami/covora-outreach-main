import Link from "next/link";
import { getWorkspace } from "@/lib/auth";
import { callCommentsApi } from "@/lib/comments-api";
import { commentDetailFromResponse, commentPageFromResponse, commentsAccess, commentsQuery, commentsUrl, type CommentPage, type CommentDetail } from "@/lib/comments";
import { commentsErrorMessage } from "@/lib/comments-transport";
import { CommentsWorkspace } from "@/components/comments-workspace";
import { WorkspaceShell } from "@/components/workspace-shell";
export const dynamic = "force-dynamic";

export default async function CommentsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const workspace = await getWorkspace(typeof params.client === "string" ? params.client : undefined);
  const query = commentsQuery(params);
  let page: CommentPage | null = null, detail: CommentDetail | null = null, error = "", detailError = "";
  const clientId = workspace.clientId;
  if (clientId && commentsAccess(workspace, clientId)) {
    try { page = commentPageFromResponse(await callCommentsApi({ kind: "list", clientId, status: query.status, offset: query.offset }), clientId); }
    catch (cause) { error = commentsErrorMessage(cause); }
    if (page?.enabled && query.requestId) {
      try { detail = commentDetailFromResponse(await callCommentsApi({ kind: "detail", clientId, requestId: query.requestId, offset: query.messageOffset }), clientId, query.requestId); }
      catch (cause) { detailError = commentsErrorMessage(cause); }
    }
  }
  return <WorkspaceShell workspace={workspace} active="comments" title="Comments" subtitle="Request changes and keep the conversation in one place." showPreviewNotice={false} showPreviewBadge={false}>
    {clientId && page?.enabled
      ? <CommentsWorkspace key={clientId} clientId={clientId} page={page} detail={detail} query={query} detailError={detailError} />
      : <section className="panel empty-state"><h2>{error ? "Comments unavailable" : page ? "Comments are being set up" : "Workspace access required"}</h2><p role={error ? "alert" : undefined}>{error || (page ? "Your Covora team is preparing this space for your requests." : "Your account manager can help you access the right company workspace.")}</p>{error && clientId ? <Link className="text-link" href={commentsUrl(clientId)}>Try again</Link> : <Link className="text-link" href="/">Back to overview</Link>}</section>}
  </WorkspaceShell>;
}
