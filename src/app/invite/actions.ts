"use server";
import { revalidatePath } from "next/cache";
import { callTeamApi } from "@/lib/team-api";
import { isInvitationToken, isUuid, invitationFromResponse, type InspectedInvitation } from "@/lib/team";
import { teamErrorMessage } from "@/lib/team-transport";
import { createClient } from "@/lib/supabase/server";
import { invitationFailureReason, logInvitationStep, reasonCode } from "@/lib/invitation-log";
export async function activateInvitedAccount(loginToken: string): Promise<{ error?: string; ok?: boolean }> {
  if (!/^[A-Za-z0-9_-]{20,256}$/.test(loginToken)) { logInvitationStep("activate", "failed", "malformed_link"); return { error: "Open the complete invitation link." }; }
  const client = await createClient();
  const current = await client.auth.getUser();
  if (current.data.user) { logInvitationStep("activate", "failed", "already_signed_in"); return { error: "You are already signed in. Review the invitation using your current account or sign out first." }; }
  // "resume_" marks a one-time sign-in for someone who started setting up their login but never
  // finished; it is issued only when such a person is added again. Otherwise it is a new-login invite.
  const result = loginToken.startsWith("resume_")
    ? await client.auth.verifyOtp({ token_hash: loginToken.slice("resume_".length), type: "email" })
    : await client.auth.verifyOtp({ token_hash: loginToken, type: "invite" });
  if (result.error || !result.data.user) {
    logInvitationStep("activate", "failed", reasonCode(result.error?.code, "activation_failed"));
    return { error: "This account activation link has expired or was already used. Sign in if you have a password, or ask Covora for a new invitation." };
  }
  logInvitationStep("activate", "ok", "ok");
  return { ok: true };
}
export async function setInvitedAccountPassword(token: string, password: string): Promise<{ error?: string; ok?: boolean }> {
  if (typeof password !== "string" || password.length < 12 || password.length > 128) { logInvitationStep("set_password", "failed", "password_length"); return { error: "Use a password between 12 and 128 characters." }; }
  const inspected = await inspectInvitation(token);
  if (!inspected.invitation || inspected.error) { logInvitationStep("set_password", "failed", "invitation_unverified"); return { error: "Your invitation could not be verified. Reopen the invitation or contact Covora." }; }
  const client = await createClient();
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) { logInvitationStep("set_password", "failed", "signed_out"); return { error: "Sign in to continue." }; }
  const result = await client.auth.updateUser({ password });
  logInvitationStep("set_password", result.error ? "failed" : "ok", result.error ? reasonCode(result.error.code, "update_failed") : "ok");
  return result.error ? { error: "The password could not be saved. Try a different password or contact Covora." } : { ok: true };
}
export async function inspectInvitation(token: string): Promise<{ invitation?: InspectedInvitation; error?: string }> {
  if (!isInvitationToken(token)) { logInvitationStep("inspect", "failed", "malformed_link"); return { error: "This invitation link is incomplete. Ask your account manager for a new link." }; }
  try { return { invitation: invitationFromResponse(await callTeamApi({ kind: "inspect", body: { token } })) }; }
  catch (cause) { logInvitationStep("inspect", "failed", invitationFailureReason(cause)); return { error: teamErrorMessage(cause) }; }
}
export async function acceptInvitation(token: string): Promise<{ clientId?: string; error?: string }> {
  if (!isInvitationToken(token)) { logInvitationStep("accept", "failed", "malformed_link"); return { error: "This invitation link is incomplete. Ask your account manager for a new link." }; }
  try {
    const result = await callTeamApi({ kind: "accept", body: { token } });
    if (!result || typeof result !== "object" || !("clientId" in result) || !isUuid(result.clientId)) throw new Error();
    revalidatePath("/"); revalidatePath("/settings/team");
    return { clientId: result.clientId };
  } catch (cause) { logInvitationStep("accept", "failed", invitationFailureReason(cause)); return { error: teamErrorMessage(cause) }; }
}
