import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/database.types";
import { authConfig } from "@/lib/supabase/config";

/** Every query uses the current user's cookie session and database policies. */
export async function createClient() {
  const cookieStore = await cookies();
  const { url, key } = authConfig();
  return createServerClient<Database>(url, key, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(values) {
        try {
          values.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Server Components cannot write cookies. The request proxy refreshes
          // them before rendering; actions and route handlers can write here.
        }
      },
    },
  });
}
