import type { ResultsData, WorkspaceInfo } from "./model";
import { activeCampaignResults } from "./workspace-results-policy";

/** Preparation guidance must never replace partial or recorded results. */
export function showWorkspaceWelcome(workspace: WorkspaceInfo, data: ResultsData): boolean {
  return Boolean(
    workspace.enabled && workspace.clientId && workspace.role &&
    !activeCampaignResults(workspace.clientId, "overview") &&
    !data.truncated && !data.networkUnavailable && data.unread === 0 &&
    [data.campaigns, data.daily, data.steps, data.leads, data.messages, data.linkedin, data.networkCampaigns]
      .every((records) => records.length === 0),
  );
}
