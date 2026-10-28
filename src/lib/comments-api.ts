import "server-only";
import { createClient } from "@/lib/supabase/server";
import { outboundOrigin } from "@/lib/outbound-transport";
import { CommentsServiceError, commentsApiRequest, type CommentsOperation } from "./comments-transport";
export async function callCommentsApi(operation: CommentsOperation): Promise<unknown> {
  let origin: string;
  try { origin = outboundOrigin(process.env.OUTBOUND_API_ORIGIN, process.env.NODE_ENV === "development"); }
  catch { throw new CommentsServiceError("Comments are being set up. Please check back shortly."); }
  const client = await createClient();
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) throw new CommentsServiceError("Your session has expired. Sign in again to continue.");
  const { data: { session } } = await client.auth.getSession();
  if (!session?.access_token || session.user.id !== user.id) throw new CommentsServiceError("Your session has expired. Sign in again to continue.");
  return commentsApiRequest(origin, session.access_token, operation);
}
