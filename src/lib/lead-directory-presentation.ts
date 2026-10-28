import "server-only";
import type { Workspace } from "./access";
import type { LeadDirectoryPage, LeadDirectoryQuery } from "./verified-leads";

/** Imported contacts always retain their real verification, including preview workspaces. */
export async function loadLeadDirectoryPresentation(
  workspace: Workspace,
  query: LeadDirectoryQuery,
  load: (clientId: string, query: LeadDirectoryQuery) => Promise<LeadDirectoryPage>,
) {
  if (!workspace.enabled || !workspace.clientId || !workspace.role) return null;
  const page = await load(workspace.clientId, query);
  if (page.clientId !== workspace.clientId) throw new Error("Lead workspace mismatch.");
  return { page };
}
