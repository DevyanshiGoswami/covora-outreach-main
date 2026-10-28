import { getWorkspace } from "@/lib/auth";
import { canManageTeam, type TeamData } from "@/lib/team";
import { loadTeam } from "@/lib/team-api";
import { teamErrorMessage } from "@/lib/team-transport";
import { TeamWorkspace } from "@/components/team-workspace";
export const dynamic = "force-dynamic";
export default async function TeamPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const workspace = await getWorkspace(typeof params.client === "string" ? params.client : undefined);
  let data: TeamData = { members: [], invitations: [] };
  let error: string | undefined;
  if (workspace.enabled && workspace.clientId && canManageTeam(workspace.role)) {
    try { data = await loadTeam(workspace.clientId); }
    catch (cause) { error = teamErrorMessage(cause); }
  }
  return <TeamWorkspace workspace={workspace} data={data} error={error} />;
}
