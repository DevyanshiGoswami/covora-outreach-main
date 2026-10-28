"use server";
import { revalidatePath } from "next/cache";
import { callTeamApi } from "@/lib/team-api";
import { ownerInvitation, ownerList } from "@/lib/owners";
import { isUuid } from "@/lib/team";
export async function inviteOwner(email: string) {
  if (
    typeof email !== "string" ||
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  )
    return { error: "Enter a valid email address." };
  try {
    const invitation = ownerInvitation(
      await callTeamApi({
        kind: "ownerInvite",
        body: { email: email.trim().toLowerCase() },
      }),
    );
    revalidatePath("/agency/owners");
    return { invitation };
  } catch {
    return {
      error:
        "Invitation could not be created. Confirm you are an agency owner, check whether this person is already an owner, and try again.",
    };
  }
}
export async function revokeOwnerAccess(
  id: string,
  version: number,
  invitation = false,
) {
  if (!isUuid(id) || !Number.isSafeInteger(version) || version < 1)
    return { error: "Refresh and try again." };
  try {
    if (!invitation && !ownerList(await callTeamApi({ kind: "owners", body: {} })).canRemoveOwners)
      return { error: "Your account does not have permission to remove owners." };
    await callTeamApi(
      invitation
        ? { kind: "ownerRevokeInvitation", body: { invitationId: id } }
        : {
            kind: "ownerRevoke",
            body: { userId: id, expectedVersion: version },
          },
    );
    revalidatePath("/agency/owners");
    revalidatePath("/agency");
    return { ok: true };
  } catch {
    return {
      error:
        "Access could not be changed. Refresh current access. At least one active agency owner must remain.",
    };
  }
}
