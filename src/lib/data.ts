import "server-only";
import { createClient } from "@/lib/supabase/server";
import { EMPTY_DATA, type ResultsData, type Selection, type WorkspaceInfo } from "./model";
import { readResults } from "./results-reader";

/** Only the current user's session can read the tenant-scoped neutral views. */
export async function loadResults(workspace: WorkspaceInfo, selection: Selection): Promise<ResultsData> {
  if (!workspace.enabled || !workspace.clientId) return { ...EMPTY_DATA };
  return readResults(await createClient(), workspace, selection);
}
