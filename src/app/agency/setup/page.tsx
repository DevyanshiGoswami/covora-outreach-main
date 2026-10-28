import { loadOnboarding } from "@/lib/onboarding-api";
import { isPreviewWorkspace } from "@/lib/access";
import { workspacePreview } from "@/lib/workspace-preview";
import { PreviewAccounts } from "@/components/preview-accounts";
import { getWorkspace } from "@/lib/auth";
import { loadSetupRequests } from "@/lib/outbound-api";
import { loadAccounts } from "@/lib/accounts-api";
import { loadSettingsData, type SettingsData } from "@/lib/settings-data";
import { SetupWorkspace } from "@/components/setup-workspace";

export const dynamic = "force-dynamic";
export default async function AgencySetupPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const workspace = await getWorkspace(typeof params.client === "string" ? params.client : undefined, true);
  if (isPreviewWorkspace(workspace)) return <PreviewAccounts workspace={workspace} connections={workspacePreview(workspace)?.connections ?? []} agency />;
  const data: SettingsData = workspace.enabled && workspace.clientId
    ? await loadSettingsData(workspace.clientId, { requests: loadSetupRequests, accounts: loadAccounts })
    : { requests: [], accountData: null, now: 0 };
  const onboarding = workspace.enabled && workspace.clientId ? await loadOnboarding(workspace.clientId) : undefined;
  return <SetupWorkspace workspace={workspace} onboarding={onboarding} {...data} agency />;
}
