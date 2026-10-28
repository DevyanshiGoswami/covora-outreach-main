import "server-only";
import { createClient } from "@/lib/supabase/server";
import { outboundOrigin } from "./outbound-transport";
import { outreachApiRequest, OutreachServiceError, type OutreachOperation } from "./outreach-transport";
export { OutreachServiceError } from "./outreach-transport";

export async function callOutreachApi(operation: OutreachOperation): Promise<unknown> {
  let origin: string;
  try { origin = outboundOrigin(process.env.OUTBOUND_API_ORIGIN, process.env.NODE_ENV === "development"); }
  catch { throw new OutreachServiceError("Outreach is not configured for this workspace."); }
  const client = await createClient();
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) throw new OutreachServiceError("Your session has expired. Sign in again to continue.");
  const { data: { session } } = await client.auth.getSession();
  if (!session?.access_token || session.user.id !== user.id) throw new OutreachServiceError("Your session has expired. Sign in again to continue.");
  return outreachApiRequest(origin, session.access_token, operation);
}
