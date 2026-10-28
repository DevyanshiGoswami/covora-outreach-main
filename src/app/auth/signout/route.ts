import { loginPath } from "@/lib/invitation-session";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAuthConfigured } from "@/lib/supabase/config";

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  // The server URL can use an internal hostname; browser Origin must match
  // the public request Host, which browsers cannot override for a form POST.
  let sameHost = false;
  try {
    sameHost = !!origin && new URL(origin).host === request.headers.get("host");
  } catch {}
  if (!sameHost || request.headers.get("sec-fetch-site") === "cross-site") {
    return NextResponse.json(
      { error: "This request could not be verified." },
      { status: 403 },
    );
  }
  if (isAuthConfigured()) {
    const client = await createClient();
    const { error } = await client.auth.signOut({ scope: "local" });
    if (error)
      return NextResponse.json(
        { error: "Sign-out could not be completed. Please try again." },
        { status: 503 },
      );
  }
  return new NextResponse(null, {
    status: 303,
    headers: { Location: loginPath(new URL(request.url).searchParams.get("next")) },
  });
}
