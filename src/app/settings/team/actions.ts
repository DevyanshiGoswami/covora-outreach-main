"use server";
import { revalidatePath } from "next/cache";
import { getWorkspace } from "@/lib/auth";
import { callOnboardingApi } from "@/lib/onboarding-api";
import { callTeamApi, loadTeam } from "@/lib/team-api";
import { canManageTeam, canManageMember, parseInviteInput, parseMemberUpdate, isUuid, createdInvitationFromResponse, type TeamActionState } from "@/lib/team";
import { teamErrorMessage } from "@/lib/team-transport";
import { invitationFailureReason, logInvitationStep } from "@/lib/invitation-log";
const refresh = () => { revalidatePath("/settings/team"); revalidatePath("/settings"); revalidatePath("/"); };
const denied = { error: "You do not have permission to manage this team's access." };
export async function createInvitation(_previous: TeamActionState, form: FormData): Promise<TeamActionState> {
  const input = parseInviteInput(Object.fromEntries(form));
  if (!input) return { error: "Enter a valid email address and choose an available role." };
  const workspace = await getWorkspace(input.clientId);
  if (!workspace.enabled || !canManageTeam(workspace.role) || !canManageMember(workspace.role, input.role)) return denied;
  try {
    const invitation = createdInvitationFromResponse(await callOnboardingApi("invitations", input));
    refresh();
    return { invitation, message: "Invitation created. Copy and share the link; no email was sent." };
  } catch (cause) { logInvitationStep("create", "failed", invitationFailureReason(cause), { clientId: input.clientId }); return { error: teamErrorMessage(cause) }; }
}
export async function revokeInvitation(_previous: TeamActionState, form: FormData): Promise<TeamActionState> {
  const clientId = form.get("clientId"), invitationId = form.get("invitationId");
  if (!isUuid(clientId) || !isUuid(invitationId)) return denied;
  const workspace = await getWorkspace(clientId);
  if (!workspace.enabled || !canManageTeam(workspace.role)) return denied;
  try {
    const team = await loadTeam(clientId);
    const invitation = team.invitations.find((item) => item.id === invitationId);
    if (!invitation || !canManageMember(workspace.role, invitation.role) || !["pending", "revoked"].includes(invitation.status)) return { error: "This invitation changed. Refresh to see the current status." };
    const result = await callTeamApi({ kind: "revoke", body: { invitationId } });
    if (!result || typeof result !== "object" || !("ok" in result) || result.ok !== true) throw new Error();
    refresh(); return { message: "Invitation revoked. Its link no longer grants access." };
  } catch (cause) { return { error: teamErrorMessage(cause) }; }
}
export async function updateMember(_previous: TeamActionState, form: FormData): Promise<TeamActionState> {
  const input = parseMemberUpdate(Object.fromEntries(form));
  if (!input) return { error: "Choose a valid role and access state, then refresh before saving." };
  const workspace = await getWorkspace(input.clientId);
  if (!workspace.enabled || !canManageTeam(workspace.role) || !canManageMember(workspace.role, input.role)) return denied;
  try {
    const team = await loadTeam(input.clientId);
    const member = team.members.find((item) => item.user_id === input.userId);
    if (!member || !canManageMember(workspace.role, member.role)) return denied;
    if (member.version !== input.expectedVersion) return { error: "This person's access changed while you were editing. Refresh the page and review the current access before saving." };
    const result = await callTeamApi({ kind: "member", body: input });
    if (!result || typeof result !== "object" || !("ok" in result) || result.ok !== true) throw new Error();
    refresh(); return { message: "Outbound access updated. Their Covora Outreach sign-in account is unchanged." };
  } catch (cause) { return { error: teamErrorMessage(cause) }; }
}
