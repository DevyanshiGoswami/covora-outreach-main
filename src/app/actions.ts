"use server";

import { refresh } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { canUseLiveWorkspace } from "@/lib/access";
import { getWorkspace } from "@/lib/auth";
import { completeReadSelection, validReadSelection } from "@/lib/inbox";
import { createClient } from "@/lib/supabase/server";

type ReadResult = { ok: true } | { ok: false; error: string };
const READ_ERROR =
  "Could not mark this conversation as read. Please try again.";

export async function markMessagesRead(input: unknown): Promise<ReadResult> {
  const selection = validReadSelection(input);
  if (!selection) return { ok: false, error: READ_ERROR };
  try {
    const workspace = await getWorkspace(selection.clientId);
    if (!canUseLiveWorkspace(workspace, selection.clientId))
      return { ok: false, error: READ_ERROR };
    const client = await createClient();
    // Keep GET URLs below gateway limits, while authorizing the entire request
    // before a single atomic RPC. Admins must also stay in the selected client.
    const batches: string[][] = [];
    for (let index = 0; index < selection.ids.length; index += 100)
      batches.push(selection.ids.slice(index, index + 100));
    const checks = await Promise.all(
      batches.map((ids) =>
        client
          .from("client_outreach_messages")
          .select("id")
          .eq("client_id", workspace.clientId!)
          .eq("direction", "received")
          .in("id", ids),
      ),
    );
    if (
      checks.some((result) => result.error) ||
      !completeReadSelection(
        selection.ids,
        checks.flatMap((result) => result.data ?? []),
      )
    ) {
      return { ok: false, error: READ_ERROR };
    }
    const { error } = await client.rpc("mark_outreach_messages_read", {
      ids: selection.ids,
    });
    if (error) return { ok: false, error: READ_ERROR };
    refresh();
    return { ok: true };
  } catch (error) {
    unstable_rethrow(error);
    return { ok: false, error: READ_ERROR };
  }
}
