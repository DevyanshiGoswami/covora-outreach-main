import "server-only";
import { redirect } from "next/navigation";
import { verifiedRequestAuth } from "@/lib/verified-request-auth";
import { isAuthConfigured } from "@/lib/supabase/config";
import { resolveWorkspace, canManageSetup, type Workspace } from "@/lib/access";
import { loginPath } from "@/lib/invitation-session";
export type { Workspace } from "@/lib/access";

/** Membership is always checked. Authentication is shared only within one render. */
export async function getWorkspace(requestedClientId?: string, agencyOnly = false, returnTo: string = "/"): Promise<Workspace> {
  if (!isAuthConfigured()) redirect(loginPath(returnTo));
  const { client, user, error } = await verifiedRequestAuth();
  if (error || !user) redirect(loginPath(returnTo));
  const rows: { client_id: unknown; client_name: unknown; role: unknown; presentation_mode?: unknown }[] = [];
  for (let offset = 0; ; offset += 500) {
    const page = await client.from("client_outreach_workspaces")
      .select("client_id, client_name, role, presentation_mode").order("client_name").order("client_id").range(offset, offset + 499);
    if (page.error) throw new Error("Workspace access could not be checked. Please try again.");
    rows.push(...page.data);
    if (page.data.length < 500) break;
  }
  const all = resolveWorkspace(rows);
  return resolveWorkspace(all.clients.filter((item) => !agencyOnly || canManageSetup(item.role))
    .map((item) => ({ client_id: item.id, client_name: item.name, role: item.role, presentation_mode: item.presentationMode })), requestedClientId);
}
