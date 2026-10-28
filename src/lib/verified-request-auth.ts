import "server-only";
import { cache } from "react";
import { createClient } from "./supabase/server";

/** React scopes this memo to one server render, never another user or request. */
export const verifiedRequestAuth = cache(async () => {
  const client = await createClient();
  const { data: { user }, error } = await client.auth.getUser();
  return { client, user, error };
});
