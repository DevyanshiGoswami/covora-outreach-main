import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/database.types";
import { authConfig, isAuthConfigured } from "@/lib/supabase/config";

/** Keep development previews private to local runs and refresh session cookies. */
export async function proxy(request: NextRequest) {
  if (process.env.NODE_ENV !== "development" && /^\/demo(?:\/|$)/.test(request.nextUrl.pathname)) {
    return new NextResponse("Page not found.", { status: 404, headers: { "Cache-Control": "no-store" } });
  }
  let response = NextResponse.next({ request });
  if (!isAuthConfigured()) return response;
  const { url, key } = authConfig();
  const client = createServerClient<Database>(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(values) {
        values.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        values.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });
  await client.auth.getUser();
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
