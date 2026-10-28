import type { View } from "./model";

/** Results presentation policy; membership and data access remain independently authorized. */
export function activeCampaignResults(clientId: string | null, view: View): boolean {
  return clientId === "6961ac6c-63ce-4e86-b02e-23656fef12bc" &&
    (view === "overview" || view === "campaigns");
}
