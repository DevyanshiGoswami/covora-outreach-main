"use server";
import { revalidatePath } from "next/cache";
import { callTeamApi } from "@/lib/team-api";
import { ownerOffer } from "@/lib/owners";
import { isInvitationToken } from "@/lib/team";
import { createClient } from "@/lib/supabase/server";
export async function inspectOwnerInvitation(token: string) {
  if (!isInvitationToken(token))
    return { error: "Open the complete invitation link." };
  try {
    return {
      invitation: ownerOffer(
        await callTeamApi({ kind: "ownerInspect", body: { token } }),
      ),
    };
  } catch {
    return {
      error:
        "This invitation is unavailable for this account. Use the invited email, or ask an agency owner for a new link.",
    };
  }
}
export async function activateOwnerAccount(loginToken: string) {
  if (
    typeof loginToken !== "string" ||
    !/^[A-Za-z0-9_-]{20,256}$/.test(loginToken)
  )
    return { error: "Open the complete activation link." };
  const client = await createClient();
  const current = await client.auth.getUser();
  if (current.data.user)
    return {
      error:
        "You are already signed in. Review the invitation or sign out first.",
    };
  const result = await client.auth.verifyOtp({
    type: "invite",
    token_hash: loginToken,
  });
  if (result.error || !result.data.user)
    return {
      error:
        "Activation expired or was already used. Sign in if you have a password, or ask for a fresh invitation.",
    };
  return { ok: true };
}
export async function saveOwnerPassword(token: string, password: string) {
  if (
    typeof password !== "string" ||
    password.length < 12 ||
    password.length > 128
  )
    return { error: "Use a password between 12 and 128 characters." };
  const inspected = await inspectOwnerInvitation(token);
  if (!inspected.invitation) return { error: inspected.error };
  const client = await createClient();
  const result = await client.auth.updateUser({ password });
  return result.error
    ? { error: "Password could not be saved. Try a different password." }
    : { ok: true };
}
export async function acceptOwnerInvitation(token: string) {
  if (!isInvitationToken(token))
    return { error: "Open the complete invitation link." };
  try {
    await callTeamApi({ kind: "ownerAccept", body: { token } });
    revalidatePath("/agency");
    revalidatePath("/agency/owners");
    return { ok: true };
  } catch {
    return {
      error:
        "Owner access could not be accepted. Set your password first, check the invited email, or ask for a fresh invitation.",
    };
  }
}
